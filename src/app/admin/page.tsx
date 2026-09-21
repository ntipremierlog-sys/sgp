"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Settings,
  Users,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  History,
  Search,
  Plus,
  Edit2,
  MapPin,
  Lock,
  KeyRound,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertTriangle,
  X,
  ExternalLink,
  Save,
  Clock,
  Building,
} from "lucide-react";
import {
  carregarUsuarios,
  criarUsuario,
  atualizarPerfilUsuario,
  atualizarBasesUsuario,
  alterarStatusUsuario,
  redefinirSenhaLocal,
  excluirUsuario,
  carregarLogsAuditoriaAdmin,
  registrarLogAuditoriaAdmin,
  ehUltimoAdminAtivo,
} from "@/lib/auth/usuarios";
import {
  obterParametrosContrato,
  salvarParametrosContrato,
  listarConfiguracoesPendentes,
  temConfiguracaoPendente,
} from "@/lib/auth/parametros";
import {
  MATRIZ_PERMISSOES,
  NOMES_PERFIS,
  can,
} from "@/lib/auth/permissoes";
import {
  UsuarioCadastro,
  UsuarioSessao,
  PerfilUsuario,
  StatusUsuario,
  TipoConta,
  ParametrosContrato,
  LogAuditoriaAdmin,
} from "@/lib/auth/tipos";
import {
  carregarMapeamentosSecao,
  vincularSecaoBase,
  salvarMapeamentosSecao,
  carregarCatalogoHorarios,
  MapeamentoSecao,
  HorarioRmItem,
  BASES_SGP_SISTEMA,
} from "@/lib/dados/secoes-horarios";
import {
  carregarEstado,
  salvarEstado,
  EstadoOperacionalCompleto,
} from "@/lib/dados/estado-operacional";
import {
  DivergenciaConciliacao,
  TipoDivergencia,
  ConfiguracaoEquivalencias,
  EQUIVALENCIAS_PADRAO,
} from "@/lib/dados/conciliacao-sifac";
import AcessoNegadoPage from "../acesso-negado/page";

type AbaAdmin = "USUARIOS" | "PERMISSOES" | "CONFIGURACOES_PENDENTES" | "PARAMETROS" | "AUDITORIA" | "SECOES";

const BASES_DISPONIVEIS = [
  { id: "TODAS", nome: "Todas as Bases Contratuais" },
  { id: "UFN-III", nome: "UFN III – Três Lagoas/MS" },
  { id: "MACAE", nome: "Macaé / Parque de Tubos" },
  { id: "SANTOS", nome: "Terminal Santos/SP" },
  { id: "PAULINIA", nome: "Refinaria Paulínia (Replan)" },
];

export default function AdminPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaAdmin>("USUARIOS");
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Dados
  const [usuarios, setUsuarios] = useState<UsuarioCadastro[]>([]);
  const [parametros, setParametros] = useState<ParametrosContrato>(obterParametrosContrato());
  const [logsAuditoria, setLogsAuditoria] = useState<LogAuditoriaAdmin[]>([]);
  const [secoes, setSecoes] = useState<MapeamentoSecao[]>([]);
  const [catalogoHorarios, setCatalogoHorarios] = useState<HorarioRmItem[]>([]);
  const [mensagemSucesso, setMensagemSucesso] = useState<string>("");
  const [mensagemErro, setMensagemErro] = useState<string>("");

  // Filtros de Usuários
  const [busca, setBusca] = useState("");
  const [filtroPerfil, setFiltroPerfil] = useState<string>("TODOS");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [filtroTipoConta, setFiltroTipoConta] = useState<string>("TODOS");

  // Modais
  const [modalNovoUsuario, setModalNovoUsuario] = useState(false);
  const [modalEditarPerfil, setModalEditarPerfil] = useState<UsuarioCadastro | null>(null);
  const [modalVincularBases, setModalVincularBases] = useState<UsuarioCadastro | null>(null);

  // Form Novo Usuário
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formEmpresa, setFormEmpresa] = useState<"Premier Logistics" | "Petróleo Brasileiro S.A. – Petrobras">("Premier Logistics");
  const [formPerfil, setFormPerfil] = useState<PerfilUsuario>("PREMIER_GESTOR");
  const [formTipoConta, setFormTipoConta] = useState<TipoConta>("LOCAL");
  const [formBases, setFormBases] = useState<string[]>(["TODAS"]);
  const [formCargo, setFormCargo] = useState("");

  // Form Edição de Perfil
  const [novoPerfilSelecionado, setNovoPerfilSelecionado] = useState<PerfilUsuario>("PREMIER_GESTOR");

  // Form Vínculo de Bases
  const [basesSelecionadas, setBasesSelecionadas] = useState<string[]>([]);

  // Form Parâmetros do Contrato
  const [formFatorGlosa, setFormFatorGlosa] = useState<string>("");
  const [formPrazoFechamento, setFormPrazoFechamento] = useState<string>("");
  const [formMetaSla, setFormMetaSla] = useState<string>("95.0");

  useEffect(() => {
    const carregarTudo = async () => {
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

      setUsuarios(carregarUsuarios());
      const params = obterParametrosContrato();
      setParametros(params);
      setFormFatorGlosa(params.fatorGlosa !== null && params.fatorGlosa !== undefined ? String(params.fatorGlosa) : "");
      setFormPrazoFechamento(params.prazoFechamento || "");
      setFormMetaSla(String(params.metaSla || 95.0));
      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      setSecoes(carregarMapeamentosSecao());
      setCatalogoHorarios(carregarCatalogoHorarios());
    };

    carregarTudo();

    const sincronizar = () => {
      setUsuarios(carregarUsuarios());
      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      setParametros(obterParametrosContrato());
      setSecoes(carregarMapeamentosSecao());
      setCatalogoHorarios(carregarCatalogoHorarios());
    };

    window.addEventListener("sgp-usuarios-atualizados", sincronizar);
    window.addEventListener("sgp-parametros-atualizados", sincronizar);
    window.addEventListener("sgp-auditoria-admin-atualizada", sincronizar);
    window.addEventListener("sgp-secoes-atualizadas", sincronizar);
    window.addEventListener("sgp-horarios-atualizados", sincronizar);

    return () => {
      window.removeEventListener("sgp-usuarios-atualizados", sincronizar);
      window.removeEventListener("sgp-parametros-atualizados", sincronizar);
      window.removeEventListener("sgp-auditoria-admin-atualizada", sincronizar);
      window.removeEventListener("sgp-secoes-atualizadas", sincronizar);
      window.removeEventListener("sgp-horarios-atualizados", sincronizar);
    };
  }, []);

  const pendencias = useMemo(() => listarConfiguracoesPendentes(parametros), [parametros]);

  // Divergências críticas abertas da Conciliação SIFAC (Tipos 1, 2, 4, 7, 10 e 12)
  const [divergenciasCriticasAbertas, setDivergenciasCriticasAbertas] = useState<DivergenciaConciliacao[]>([]);
  const [equivalenciasSifac, setEquivalenciasSifac] = useState<ConfiguracaoEquivalencias>(EQUIVALENCIAS_PADRAO);

  useEffect(() => {
    const carregarDivergencias = () => {
      const estadoAtual = carregarEstado();
      if (estadoAtual.equivalenciasConciliacao) {
        setEquivalenciasSifac(estadoAtual.equivalenciasConciliacao);
      }
      const mapa = estadoAtual.divergenciasConciliacao || {};
      const todas = Object.values(mapa).flat();
      const tiposCriticos: TipoDivergencia[] = [
        "NAO_ENCONTRADO_RM", // 1
        "NAO_INFORMADO_SIFAC", // 2
        "SITUACAO_INCONSISTENTE_DEMITIDO", // 4
        "CARGO_DIVERGENTE", // 7
        "GENERO_DIVERGENTE", // 10
        "DADO_OBRIGATORIO_AUSENTE", // 12
      ];
      setDivergenciasCriticasAbertas(
        todas.filter((d) => d.status === "ABERTA" && tiposCriticos.includes(d.tipo))
      );
    };

    carregarDivergencias();
    window.addEventListener("sgp-dados-atualizados", carregarDivergencias);
    return () => window.removeEventListener("sgp-dados-atualizados", carregarDivergencias);
  }, []);

  const exibirAlerta = (msg: string, erro = false) => {
    if (erro) {
      setMensagemErro(msg);
      setMensagemSucesso("");
      setTimeout(() => setMensagemErro(""), 5000);
    } else {
      setMensagemSucesso(msg);
      setMensagemErro("");
      setTimeout(() => setMensagemSucesso(""), 4000);
    }
  };

  // Verificação no cliente (o servidor e middleware já protegem a rota /admin)
  if (!carregandoSessao && (!sessao || !can(sessao, "LER", "ADMINISTRACAO"))) {
    return <AcessoNegadoPage />;
  }

  // Filtros de Usuários
  const usuariosFiltrados = usuarios.filter((u) => {
    const termo = busca.toLowerCase().trim();
    const matchBusca =
      !busca ||
      u.nome.toLowerCase().includes(termo) ||
      u.email.toLowerCase().includes(termo) ||
      u.cargo?.toLowerCase().includes(termo);

    const matchPerfil = filtroPerfil === "TODOS" || u.perfil === filtroPerfil;
    const matchStatus = filtroStatus === "TODOS" || u.status === filtroStatus;
    const matchTipoConta = filtroTipoConta === "TODOS" || u.tipoConta === filtroTipoConta;

    return matchBusca && matchPerfil && matchStatus && matchTipoConta;
  });

  // Ações de Usuário
  const handleCriarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessao) return;
    if (!formNome.trim() || !formEmail.trim()) {
      exibirAlerta("Preencha nome e e-mail corporativo.", true);
      return;
    }

    try {
      criarUsuario(
        {
          nome: formNome.trim(),
          email: formEmail.trim().toLowerCase(),
          empresa: formEmpresa,
          perfil: formPerfil,
          status: "ATIVO",
          tipoConta: formTipoConta,
          basesVinculadas: formBases.length > 0 ? formBases : ["TODAS"],
          cargo: formCargo.trim() || undefined,
        },
        sessao
      );

      setUsuarios(carregarUsuarios());
      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      setModalNovoUsuario(false);
      setFormNome("");
      setFormEmail("");
      setFormCargo("");
      exibirAlerta(`Usuário "${formNome}" cadastrado com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar usuário";
      exibirAlerta(msg, true);
    }
  };

  const handleSalvarPerfil = () => {
    if (!sessao || !modalEditarPerfil) return;

    try {
      atualizarPerfilUsuario(modalEditarPerfil.id, novoPerfilSelecionado, sessao);
      setUsuarios(carregarUsuarios());
      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      exibirAlerta(`Perfil de "${modalEditarPerfil.nome}" atualizado para ${NOMES_PERFIS[novoPerfilSelecionado]}.`);
      setModalEditarPerfil(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao alterar perfil";
      exibirAlerta(msg, true);
    }
  };

  const handleSalvarBases = () => {
    if (!sessao || !modalVincularBases) return;

    try {
      atualizarBasesUsuario(modalVincularBases.id, basesSelecionadas, sessao);
      setUsuarios(carregarUsuarios());
      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      exibirAlerta(`Bases vinculadas para "${modalVincularBases.nome}" atualizadas.`);
      setModalVincularBases(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Falha ao vincular bases";
      exibirAlerta(msg, true);
    }
  };

  const handleAlternarStatus = (u: UsuarioCadastro) => {
    if (!sessao) return;
    const novoStatus: StatusUsuario = u.status === "ATIVO" ? "INATIVO" : "ATIVO";
    const acaoVerbo = novoStatus === "ATIVO" ? "ativar" : "desativar";

    if (confirm(`Deseja realmente ${acaoVerbo} o usuário "${u.nome}"? ${novoStatus === "INATIVO" ? "O acesso será revogado imediatamente." : ""}`)) {
      try {
        alterarStatusUsuario(u.id, novoStatus, sessao);
        setUsuarios(carregarUsuarios());
        setLogsAuditoria(carregarLogsAuditoriaAdmin());
        exibirAlerta(`Status de "${u.nome}" alterado para ${novoStatus}.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Erro ao alterar status";
        exibirAlerta(msg, true);
      }
    }
  };

  const handleRedefinirSenha = (u: UsuarioCadastro) => {
    if (!sessao) return;
    try {
      const res = redefinirSenhaLocal(u.id, sessao);
      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      exibirAlerta(res.mensagem);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao redefinir senha";
      exibirAlerta(msg, true);
    }
  };

  const handleExcluirUsuario = (u: UsuarioCadastro) => {
    if (!sessao) return;
    if (confirm(`ATENÇÃO: Deseja remover definitivamente o cadastro de "${u.nome}"? Esta ação é auditada e irreversível.`)) {
      try {
        excluirUsuario(u.id, sessao);
        setUsuarios(carregarUsuarios());
        setLogsAuditoria(carregarLogsAuditoriaAdmin());
        exibirAlerta(`Usuário "${u.nome}" removido do cadastro.`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Falha ao remover usuário";
        exibirAlerta(msg, true);
      }
    }
  };

  // Mapeamento de Seções RM
  const handleVincularSecao = (codigoSecao: string, baseId: string) => {
    if (!sessao) return;
    try {
      vincularSecaoBase(codigoSecao, baseId, true, sessao.nome);
      setSecoes(carregarMapeamentosSecao());
      registrarLogAuditoriaAdmin(
        sessao,
        "MAPEAMENTO_SECAO",
        "SECAO",
        codigoSecao,
        `Vínculo da seção RM ${codigoSecao} homologado para a base ${baseId}`,
        null,
        `Base: ${baseId}`
      );
      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      exibirAlerta(`Seção ${codigoSecao} vinculada à base ${baseId} com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao vincular seção";
      exibirAlerta(msg, true);
    }
  };

  // Salvar Parâmetros do Contrato
  const handleSalvarParametros = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessao) return;

    try {
      const glosaNum = formFatorGlosa.trim() === "" ? null : parseFloat(formFatorGlosa.replace(",", "."));
      const prazoStr = formPrazoFechamento.trim() === "" ? null : formPrazoFechamento.trim();
      const metaNum = formMetaSla.trim() === "" ? 95.0 : parseFloat(formMetaSla.replace(",", "."));

      const paramsAnteriores = obterParametrosContrato();
      const atualizado = salvarParametrosContrato(
        {
          fatorGlosa: glosaNum,
          prazoFechamento: prazoStr,
          metaSla: metaNum,
        },
        sessao.nome
      );

      setParametros(atualizado);

      // Registrar auditoria
      registrarLogAuditoriaAdmin(
        sessao,
        "ALTERAR_PARAMETROS_CONTRATO",
        "PARAMETRO_CONTRATO",
        "param-contrato-icj",
        "Atualização de parâmetros contratuais de glosa e fechamento da medição",
        `Glosa: ${paramsAnteriores.fatorGlosa ?? "NÃO CADASTRADO"} | Prazo: ${paramsAnteriores.prazoFechamento ?? "NÃO CADASTRADO"}`,
        `Glosa: ${atualizado.fatorGlosa ?? "NÃO CADASTRADO"} | Prazo: ${atualizado.prazoFechamento ?? "NÃO CADASTRADO"}`
      );

      setLogsAuditoria(carregarLogsAuditoriaAdmin());
      exibirAlerta("Parâmetros do contrato atualizados com sucesso!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar parâmetros";
      exibirAlerta(msg, true);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Topo Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#E3E6EB]">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5B6474] font-medium mb-1">
            <span className="font-semibold text-[#1F4FD1]">Premier Logistics</span>
            <span>/</span>
            <span className="text-[#1A2230] font-semibold">Controle de Governança</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1A2230] tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F1E36] text-white flex items-center justify-center shadow-xs">
              <Settings className="w-4 h-4 text-emerald-400" />
            </div>
            <span>Área de Administração</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6474] mt-0.5">
            Gestão restrita de usuários, permissões RBAC, vínculo de bases territoriais e parâmetros do contrato Petrobras.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 border border-purple-200">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
            Acesso Exclusivo: Administrador Premier
          </span>
        </div>
      </div>

      {/* Alertas */}
      {mensagemSucesso && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="p-3.5 rounded-xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-[#B42318] shrink-0" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Navegação por Abas */}
      <div className="flex items-center gap-2 border-b border-[#E3E6EB] overflow-x-auto pb-px">
        <button
          onClick={() => setAbaAtiva("USUARIOS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            abaAtiva === "USUARIOS"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários ({usuarios.length})</span>
        </button>

        <button
          onClick={() => setAbaAtiva("PERMISSOES")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            abaAtiva === "PERMISSOES"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Perfis e Permissões (Matriz)</span>
        </button>

        <button
          onClick={() => setAbaAtiva("CONFIGURACOES_PENDENTES")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            abaAtiva === "CONFIGURACOES_PENDENTES"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Configurações & Pendências</span>
          {(pendencias.length > 0 || divergenciasCriticasAbertas.length > 0) && (
            <span className="px-1.5 py-0.5 rounded-full bg-[#F79009] text-white text-[10px] font-bold">
              {pendencias.length + divergenciasCriticasAbertas.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setAbaAtiva("PARAMETROS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            abaAtiva === "PARAMETROS"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Parâmetros do Contrato</span>
        </button>

        <button
          onClick={() => setAbaAtiva("SECOES")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            abaAtiva === "SECOES"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Mapeamento de Seções & Horários</span>
          {secoes.some((s) => !s.confirmado || s.unidadeId === "NAO_MAPEADA") && (
            <span className="w-2 h-2 rounded-full bg-[#F79009] animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setAbaAtiva("AUDITORIA")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 ${
            abaAtiva === "AUDITORIA"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-blue-50/50 rounded-t-lg"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <History className="w-4 h-4" />
          <span>Trilha de Auditoria</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* ABA 1: USUÁRIOS */}
      {/* ===================================================================== */}
      {abaAtiva === "USUARIOS" && (
        <div className="space-y-4">
          {/* Barra de Filtros e Busca */}
          <div className="bg-white p-4 rounded-xl border border-[#E3E6EB] shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2.5">
              {/* Campo de Busca */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#98A2B3]" />
                <input
                  type="text"
                  placeholder="Buscar por nome, e-mail ou cargo..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
                />
              </div>

              {/* Filtro por Perfil */}
              <select
                value={filtroPerfil}
                onChange={(e) => setFiltroPerfil(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[#344054]"
              >
                <option value="TODOS">Todos os Perfis</option>
                {Object.entries(NOMES_PERFIS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>

              {/* Filtro por Status */}
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[#344054]"
              >
                <option value="TODOS">Todos os Status</option>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>

              {/* Filtro por Tipo de Conta */}
              <select
                value={filtroTipoConta}
                onChange={(e) => setFiltroTipoConta(e.target.value)}
                className="text-xs px-2.5 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[#344054]"
              >
                <option value="TODOS">Todos os Tipos de Conta</option>
                <option value="SSO_MICROSOFT">SSO Microsoft Entra ID</option>
                <option value="LOCAL">Conta Local</option>
              </select>
            </div>

            <button
              onClick={() => setModalNovoUsuario(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-xs transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Usuário</span>
            </button>
          </div>

          {/* Tabela de Usuários */}
          <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                    <th className="py-3 px-4">Nome</th>
                    <th className="py-3 px-4">E-mail</th>
                    <th className="py-3 px-4">Tipo de Conta</th>
                    <th className="py-3 px-4">Perfil</th>
                    <th className="py-3 px-4">Bases Vinculadas</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Último Acesso</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6EB]">
                  {usuariosFiltrados.map((u) => {
                    const isAdmin = u.perfil === "PREMIER_ADMIN";
                    const isSelf = sessao?.id === u.id;
                    const ehUltimoAdmin = ehUltimoAdminAtivo(u.id);

                    return (
                      <tr key={u.id} className="hover:bg-[#F9FAFB] transition-colors">
                        <td className="py-3 px-4 font-semibold text-[#1A2230]">
                          <div className="flex items-center gap-2">
                            <span>{u.nome}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded font-bold">
                                Você
                              </span>
                            )}
                          </div>
                          {u.cargo && (
                            <span className="text-[11px] text-[#5B6474] block font-normal">
                              {u.cargo}
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-4 text-[#5B6474] font-mono text-[11px]">
                          {u.email}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium ${
                              u.tipoConta === "SSO_MICROSOFT"
                                ? "bg-blue-50 text-blue-700 border border-blue-200"
                                : "bg-slate-100 text-slate-700 border border-slate-200"
                            }`}
                          >
                            {u.tipoConta === "SSO_MICROSOFT" ? "⊞ SSO Microsoft" : "Conta Local"}
                          </span>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              isAdmin
                                ? "bg-purple-100 text-purple-800"
                                : u.perfil.startsWith("PETROBRAS")
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {NOMES_PERFIS[u.perfil]}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-[#344054]">
                          <div className="flex flex-wrap gap-1 max-w-[200px]">
                            {u.basesVinculadas.map((b) => (
                              <span
                                key={b}
                                className="bg-[#F2F4F7] text-[#344054] px-1.5 py-0.5 rounded text-[10px] font-medium"
                              >
                                {b}
                              </span>
                            ))}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              u.status === "ATIVO"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-rose-50 text-rose-700 border border-rose-200"
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                u.status === "ATIVO" ? "bg-emerald-500" : "bg-rose-500"
                              }`}
                            />
                            {u.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-[11px] text-[#5B6474] font-mono">
                          {u.ultimoAcesso || "Não registrado"}
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {/* Editar Perfil */}
                            <button
                              onClick={() => {
                                setModalEditarPerfil(u);
                                setNovoPerfilSelecionado(u.perfil);
                              }}
                              disabled={isSelf}
                              className="p-1 text-[#5B6474] hover:text-[#1F4FD1] rounded hover:bg-[#F2F4F7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={isSelf ? "Não é permitido alterar o próprio perfil" : "Editar perfil"}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Vincular Bases */}
                            <button
                              onClick={() => {
                                setModalVincularBases(u);
                                setBasesSelecionadas(u.basesVinculadas);
                              }}
                              className="p-1 text-[#5B6474] hover:text-[#1F4FD1] rounded hover:bg-[#F2F4F7] transition-colors"
                              title="Vincular bases contratuais"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </button>

                            {/* Redefinir Senha (apenas contas locais) */}
                            {u.tipoConta === "LOCAL" && (
                              <button
                                onClick={() => handleRedefinirSenha(u)}
                                className="p-1 text-[#5B6474] hover:text-[#D97706] rounded hover:bg-[#FFFBEB] transition-colors"
                                title="Redefinir senha (conta local)"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Ativar / Desativar */}
                            <button
                              onClick={() => handleAlternarStatus(u)}
                              disabled={ehUltimoAdmin}
                              className={`p-1 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                                u.status === "ATIVO"
                                  ? "text-[#B42318] hover:bg-[#FEF3F2]"
                                  : "text-emerald-700 hover:bg-emerald-50"
                              }`}
                              title={
                                ehUltimoAdmin
                                  ? "Não é permitido desativar o último Administrador Premier"
                                  : u.status === "ATIVO"
                                  ? "Desativar usuário (revoga acesso imediatamente)"
                                  : "Ativar usuário"
                              }
                            >
                              {u.status === "ATIVO" ? (
                                <XCircle className="w-3.5 h-3.5" />
                              ) : (
                                <CheckCircle2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Excluir Usuário */}
                            <button
                              onClick={() => handleExcluirUsuario(u)}
                              disabled={isSelf || ehUltimoAdmin}
                              className="p-1 text-[#5B6474] hover:text-[#B42318] rounded hover:bg-[#FEF3F2] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                              title={
                                isSelf
                                  ? "Não é permitido excluir a própria conta"
                                  : ehUltimoAdmin
                                  ? "Não é permitido remover o último Administrador"
                                  : "Excluir cadastro"
                              }
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 2: PERFIS E PERMISSÕES (MATRIZ RBAC) */}
      {/* ===================================================================== */}
      {abaAtiva === "PERMISSOES" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#E3E6EB] shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[#1A2230]">
                  Matriz de Perfis e Permissões (RBAC)
                </h3>
                <p className="text-xs text-[#5B6474]">
                  Visualização somente leitura das regras vigentes aplicadas estritamente no servidor por rota e ação.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-[#F2F4F7] text-[#344054]">
                Somente Leitura
              </span>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                    <th className="py-3 px-4 min-w-[200px]">Módulo / Recurso</th>
                    <th className="py-3 px-3 text-center bg-purple-50/70 text-purple-900 border-x border-purple-100">
                      Administrador Premier
                    </th>
                    <th className="py-3 px-3 text-center">Gestor Premier</th>
                    <th className="py-3 px-3 text-center">Supervisor</th>
                    <th className="py-3 px-3 text-center">RH Premier</th>
                    <th className="py-3 px-3 text-center bg-emerald-50/70 text-emerald-900 border-x border-emerald-100">
                      Fiscal Petrobras
                    </th>
                    <th className="py-3 px-3 text-center">Gestor Petrobras</th>
                    <th className="py-3 px-3 text-center">Auditor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6EB]">
                  {MATRIZ_PERMISSOES.map((regra) => (
                    <tr key={regra.recurso} className="hover:bg-[#F9FAFB]">
                      <td className="py-3 px-4">
                        <span className="font-bold text-[#1A2230] block">
                          {regra.nomeRecurso}
                        </span>
                        <span className="text-[11px] text-[#5B6474] block">
                          {regra.descricao}
                        </span>
                      </td>

                      {/* Administrador Premier */}
                      <td className="py-3 px-3 text-center bg-purple-50/30 border-x border-purple-100">
                        {regra.acoes.PREMIER_ADMIN.length > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                            {regra.acoes.PREMIER_ADMIN.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-[#98A2B3] font-mono">—</span>
                        )}
                      </td>

                      {/* Gestor Premier */}
                      <td className="py-3 px-3 text-center">
                        {regra.acoes.PREMIER_GESTOR.length > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-semibold text-[10px]">
                            {regra.acoes.PREMIER_GESTOR.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-rose-400 text-[11px] font-medium">Sem acesso</span>
                        )}
                      </td>

                      {/* Supervisor */}
                      <td className="py-3 px-3 text-center">
                        {regra.acoes.PREMIER_SUPERVISOR.length > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            {regra.acoes.PREMIER_SUPERVISOR.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-rose-400 text-[11px] font-medium">Sem acesso</span>
                        )}
                      </td>

                      {/* RH */}
                      <td className="py-3 px-3 text-center">
                        {regra.acoes.PREMIER_RH.length > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            {regra.acoes.PREMIER_RH.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-rose-400 text-[11px] font-medium">Sem acesso</span>
                        )}
                      </td>

                      {/* Fiscal Petrobras */}
                      <td className="py-3 px-3 text-center bg-emerald-50/30 border-x border-emerald-100">
                        {regra.acoes.PETROBRAS_FISCAL.length > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[10px]">
                            {regra.acoes.PETROBRAS_FISCAL.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-rose-500 font-semibold text-[10px] bg-rose-50 px-1.5 py-0.5 rounded">
                            Bloqueado (LGPD/Contrato)
                          </span>
                        )}
                      </td>

                      {/* Gestor Petrobras */}
                      <td className="py-3 px-3 text-center">
                        {regra.acoes.PETROBRAS_GESTOR.length > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 text-[10px]">
                            {regra.acoes.PETROBRAS_GESTOR.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-rose-400 text-[11px] font-medium">Sem acesso</span>
                        )}
                      </td>

                      {/* Auditor */}
                      <td className="py-3 px-3 text-center">
                        {regra.acoes.AUDITOR.length > 0 ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px]">
                            {regra.acoes.AUDITOR.join(" · ")}
                          </span>
                        ) : (
                          <span className="text-rose-400 text-[11px] font-medium">Sem acesso</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 3: CONFIGURAÇÕES PENDENTES */}
      {/* ===================================================================== */}
      {/* ===================================================================== */}
      {/* ABA 3: CONFIGURAÇÕES E PENDÊNCIAS CADASTRAIS (MOMENTO 2) */}
      {/* ===================================================================== */}
      {abaAtiva === "CONFIGURACOES_PENDENTES" && (
        <div className="space-y-6">
          {/* Seção 1: Divergências Críticas da Conciliação SIFAC (Tipos 1, 2, 4, 7, 10 e 12) */}
          <div className="bg-white p-5 rounded-xl border border-[#E3E6EB] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E3E6EB] pb-3">
              <div>
                <h3 className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                  <span>Divergências Cadastrais Críticas SIFAC × RM</span>
                </h3>
                <p className="text-xs text-[#5B6474] mt-0.5">
                  Pendências abertas dos Tipos 1, 2, 4, 7, 10 e 12 que requerem saneamento prévio antes do fechamento fiscal com a Petrobras.
                </p>
              </div>

              <Link
                href="/conciliacao-sifac"
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#0F1E36] text-white hover:bg-[#1E2E4A] transition-colors shadow-xs shrink-0"
              >
                <span>Acessar Conciliação SIFAC</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            {divergenciasCriticasAbertas.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto mb-1" />
                <span className="text-xs font-bold text-emerald-900 block">
                  Nenhuma divergência crítica pendente no SIFAC!
                </span>
                <span className="text-[11px] text-emerald-700">
                  Todas as conciliações dos tipos 1, 2, 4, 7, 10 e 12 estão tratadas ou justificadas.
                </span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-rose-950">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Total de pendências críticas abertas: {divergenciasCriticasAbertas.length}</span>
                  </div>
                  <span className="text-[11px] text-rose-700">
                    Sincronizado com a tela de Conciliação
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <div className="p-2.5 bg-[#F8F9FC] border border-[#E3E6EB] rounded-lg">
                    <span className="text-[10px] font-bold text-[#5B6474] uppercase block">1. Não no RM</span>
                    <span className="text-base font-bold text-[#1A2230]">
                      {divergenciasCriticasAbertas.filter((d) => d.tipo === "NAO_ENCONTRADO_RM").length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#F8F9FC] border border-[#E3E6EB] rounded-lg">
                    <span className="text-[10px] font-bold text-[#5B6474] uppercase block">2. Não no SIFAC</span>
                    <span className="text-base font-bold text-[#1A2230]">
                      {divergenciasCriticasAbertas.filter((d) => d.tipo === "NAO_INFORMADO_SIFAC").length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#F8F9FC] border border-[#E3E6EB] rounded-lg">
                    <span className="text-[10px] font-bold text-[#5B6474] uppercase block">4. Demitido vs Inativo</span>
                    <span className="text-base font-bold text-[#1A2230]">
                      {divergenciasCriticasAbertas.filter((d) => d.tipo === "SITUACAO_INCONSISTENTE_DEMITIDO").length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#F8F9FC] border border-[#E3E6EB] rounded-lg">
                    <span className="text-[10px] font-bold text-[#5B6474] uppercase block">7. Cargo Divergente</span>
                    <span className="text-base font-bold text-[#1A2230]">
                      {divergenciasCriticasAbertas.filter((d) => d.tipo === "CARGO_DIVERGENTE").length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#F8F9FC] border border-[#E3E6EB] rounded-lg">
                    <span className="text-[10px] font-bold text-[#5B6474] uppercase block">10. Gênero Divergente</span>
                    <span className="text-base font-bold text-[#1A2230]">
                      {divergenciasCriticasAbertas.filter((d) => d.tipo === "GENERO_DIVERGENTE").length}
                    </span>
                  </div>
                  <div className="p-2.5 bg-[#F8F9FC] border border-[#E3E6EB] rounded-lg">
                    <span className="text-[10px] font-bold text-[#5B6474] uppercase block">12. Dado Ausente</span>
                    <span className="text-base font-bold text-[#1A2230]">
                      {divergenciasCriticasAbertas.filter((d) => d.tipo === "DADO_OBRIGATORIO_AUSENTE").length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Seção 2: Parâmetros Contratuais Pendentes de Cadastro */}
          <div className="bg-white p-5 rounded-xl border border-[#E3E6EB] shadow-xs space-y-4">
            <div className="border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-bold text-[#1A2230]">
                Parâmetros Contratuais Pendentes de Cadastro
              </h3>
              <p className="text-xs text-[#5B6474]">
                Estes parâmetros impactam diretamente o cálculo de penalidades, simulação de glosa e checklist da medição mensal do contrato.
              </p>
            </div>

            {pendencias.length === 0 ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
                <h4 className="text-xs font-bold text-emerald-900">
                  Todas as configurações contratuais estão preenchidas!
                </h4>
                <p className="text-[11px] text-emerald-700 max-w-md mx-auto">
                  O fator de glosa e o prazo de fechamento da medição estão homologados no sistema.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendencias.map((pend) => (
                  <div
                    key={pend.id}
                    className="bg-white rounded-xl border-l-4 border-l-[#F79009] border border-[#E3E6EB] p-4 shadow-xs flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-[#F79009]" />
                        <h4 className="text-sm font-bold text-[#1A2230]">
                          {pend.titulo}
                        </h4>
                      </div>
                      <p className="text-xs text-[#5B6474] leading-relaxed">
                        {pend.descricao}
                      </p>
                    </div>

                    <button
                      onClick={() => setAbaAtiva("PARAMETROS")}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F4FD1] hover:text-[#163CA8] pt-1"
                    >
                      <span>Configurar agora</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Seção 3: Tabelas de Equivalência Editáveis SIFAC × RM */}
          <div className="bg-white p-5 rounded-xl border border-[#E3E6EB] shadow-xs space-y-4">
            <div className="border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-bold text-[#1A2230]">
                Tabelas de Equivalência Homologadas para Conciliação
              </h3>
              <p className="text-xs text-[#5B6474]">
                Regras de equivalência entre códigos SIFAC e cadastro do RM (situações, cargos e base ↔ municípios IBGE).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              {/* Situações */}
              <div className="p-3.5 bg-[#F8F9FC] rounded-xl border border-[#E3E6EB] space-y-2">
                <span className="font-bold text-[#1A2230] block">Equivalência de Situações</span>
                <ul className="space-y-1 text-[11px] text-[#5B6474]">
                  <li>• RM Ativo / Aviso Prévio ↔ SIFAC 1 (Ativo)</li>
                  <li>• RM Férias ↔ SIFAC 5 (Férias)</li>
                  <li>• RM Afastado / Previdência ↔ SIFAC 4 (Afastado)</li>
                  <li>• RM Licença Maternidade ↔ SIFAC 4 (Afastado)</li>
                  <li>• RM Demitido / Desligado ↔ SIFAC 3 (Demitido)</li>
                </ul>
              </div>

              {/* Cargos */}
              <div className="p-3.5 bg-[#F8F9FC] rounded-xl border border-[#E3E6EB] space-y-2">
                <span className="font-bold text-[#1A2230] block">Sinônimos de Cargos</span>
                <ul className="space-y-1 text-[11px] text-[#5B6474]">
                  <li>• Motorista Carreta ↔ Veículos Pesados</li>
                  <li>• Almoxarife Líder ↔ Almoxarife Pleno</li>
                  <li>• Auxiliar de Almoxarifado I ↔ Assistente</li>
                  <li>• Assistente de Logística ↔ Analista Jr</li>
                </ul>
              </div>

              {/* Base RM -> Municípios IBGE */}
              <div className="p-3.5 bg-[#F8F9FC] rounded-xl border border-[#E3E6EB] space-y-2">
                <span className="font-bold text-[#1A2230] block">Base RM ↔ Municípios IBGE</span>
                <ul className="space-y-1 text-[11px] text-[#5B6474]">
                  <li>• UFN-III: Três Lagoas/MS (5008305), Brasilândia</li>
                  <li>• Macaé: Macaé/RJ (3302403), Rio das Ostras</li>
                  <li>• Santos: Santos/SP (3548500), Cubatão</li>
                  <li>• Paulínia: Paulínia/SP (3536505), Campinas</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 4: PARÂMETROS DO CONTRATO */}
      {/* ===================================================================== */}
      {abaAtiva === "PARAMETROS" && (
        <div className="max-w-2xl bg-white p-6 rounded-xl border border-[#E3E6EB] shadow-xs space-y-6">
          <div className="border-b border-[#E3E6EB] pb-4">
            <h3 className="text-sm font-bold text-[#1A2230]">
              Parâmetros Contratuais Petrobras — ICJ 5900.0129796.25.2
            </h3>
            <p className="text-xs text-[#5B6474] mt-0.5">
              Definição das constantes utilizadas pelos motores de apuração de conformidade e cálculo de glosa.
            </p>
          </div>

          <form onSubmit={handleSalvarParametros} className="space-y-5">
            {/* Campo 1: Parâmetro de Glosa */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#344054]">
                Fator Multiplicador de Glosa (ex: 1.0 = 100% do valor do posto-dia):
              </label>
              <input
                type="text"
                placeholder="Ex: 1.0 ou deixe vazio para pendente"
                value={formFatorGlosa}
                onChange={(e) => setFormFatorGlosa(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              <p className="text-[11px] text-[#667085]">
                Se deixado em branco, o sistema alertará como configuração pendente e exibirá aviso no KPI de glosa.
              </p>
            </div>

            {/* Campo 2: Prazo de Fechamento da Medição */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#344054]">
                Prazo de Fechamento da Medição com a Petrobras:
              </label>
              <input
                type="text"
                placeholder="Ex: 5º dia útil da competência seguinte"
                value={formPrazoFechamento}
                onChange={(e) => setFormPrazoFechamento(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              <p className="text-[11px] text-[#667085]">
                Exibido no checklist de medição e no card de fechamento da medição.
              </p>
            </div>

            {/* Campo 3: Meta de SLA Contratual */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-[#344054]">
                Meta de SLA Contratual (%):
              </label>
              <input
                type="text"
                placeholder="95.0"
                value={formMetaSla}
                onChange={(e) => setFormMetaSla(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
            </div>

            <div className="pt-2 border-t border-[#E3E6EB] flex items-center justify-between">
              <div className="text-[11px] text-[#5B6474]">
                Última alteração: {new Date(parametros.atualizadoEm).toLocaleString("pt-BR")} por {parametros.atualizadoPor}
              </div>

              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-xs transition-all"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Parâmetros</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 5: TRILHA DE AUDITORIA DA ADMINISTRAÇÃO */}
      {/* ===================================================================== */}
      {abaAtiva === "AUDITORIA" && (
        <div className="space-y-4">
          <div className="bg-white p-5 rounded-xl border border-[#E3E6EB] shadow-xs space-y-1">
            <h3 className="text-sm font-bold text-[#1A2230]">
              Trilha de Auditoria Exclusiva da Administração
            </h3>
            <p className="text-xs text-[#5B6474]">
              Registro imutável de criação de usuários, alterações de perfis, vínculos de bases, ativação/desativação e modificação de parâmetros.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                    <th className="py-3 px-4">Data / Hora</th>
                    <th className="py-3 px-4">Responsável</th>
                    <th className="py-3 px-4">Ação</th>
                    <th className="py-3 px-4">Descrição</th>
                    <th className="py-3 px-4">Valor Anterior</th>
                    <th className="py-3 px-4">Novo Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6EB]">
                  {logsAuditoria.map((log) => (
                    <tr key={log.id} className="hover:bg-[#F9FAFB] transition-colors">
                      <td className="py-3 px-4 text-[#5B6474] font-mono text-[11px] whitespace-nowrap">
                        {log.timestamp}
                      </td>

                      <td className="py-3 px-4 font-semibold text-[#1A2230]">
                        {log.usuarioNome}
                        <span className="text-[10px] text-[#5B6474] block font-normal">
                          {NOMES_PERFIS[log.usuarioPerfil] || log.usuarioPerfil}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded bg-[#F2F4F7] text-[#344054] font-mono text-[10px] font-bold">
                          {log.acao}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-[#344054] max-w-xs">
                        {log.descricao}
                      </td>

                      <td className="py-3 px-4 text-[11px] text-[#667085] font-mono max-w-xs truncate">
                        {log.valorAnterior || "—"}
                      </td>

                      <td className="py-3 px-4 text-[11px] text-emerald-800 font-mono font-semibold max-w-xs truncate">
                        {log.valorNovo || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 6: MAPEAMENTO DE SEÇÕES E CATÁLOGO DE HORÁRIOS RM */}
      {/* ===================================================================== */}
      {abaAtiva === "SECOES" && (
        <div className="space-y-6">
          {/* Card 1: Mapeamento de Seções */}
          <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#E3E6EB] space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#1F4FD1]" />
                    <span>Mapeamento de Seções Organizacionais RM/TOTVS → Bases SGP</span>
                  </h3>
                  <p className="text-xs text-[#5B6474] mt-0.5 max-w-3xl">
                    A autoridade de vinculação de postos e profissionais às bases territoriais Petrobras é estritamente regida pelo Código da Seção. Seções não mapeadas permanecem isoladas sob alerta até a homologação pelo Administrador Premier.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                    Total: {secoes.length} seções
                  </span>
                  <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {secoes.filter((s) => s.confirmado && s.unidadeId !== "NAO_MAPEADA").length} homologadas
                  </span>
                  {secoes.some((s) => !s.confirmado || s.unidadeId === "NAO_MAPEADA") && (
                    <span className="text-xs px-2.5 py-1 rounded-full font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                      {secoes.filter((s) => !s.confirmado || s.unidadeId === "NAO_MAPEADA").length} pendentes
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                    <th className="py-3 px-4">Código Seção RM</th>
                    <th className="py-3 px-4">Descrição no RM / TOTVS</th>
                    <th className="py-3 px-4 min-w-[240px]">Base SGP Vinculada</th>
                    <th className="py-3 px-4 text-center">Status Homologação</th>
                    <th className="py-3 px-4">Última Alteração</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6EB]">
                  {secoes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#5B6474]">
                        Nenhuma seção RM identificada ainda. Importe uma planilha de funcionários para detectar seções automaticamente.
                      </td>
                    </tr>
                  ) : (
                    secoes.map((s) => {
                      const naoMapeada = !s.unidadeId || s.unidadeId === "NAO_MAPEADA";
                      return (
                        <tr key={s.codigoSecao} className="hover:bg-[#F9FAFB] transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-[#1A2230]">
                            {s.codigoSecao}
                          </td>

                          <td className="py-3 px-4 text-[#344054] font-medium">
                            {s.descricaoSecao}
                          </td>

                          <td className="py-3 px-4">
                            <select
                              value={s.unidadeId || "NAO_MAPEADA"}
                              onChange={(e) => handleVincularSecao(s.codigoSecao, e.target.value)}
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[#344054] font-medium focus:ring-2 focus:ring-[#1F4FD1] focus:outline-none"
                            >
                              <option value="NAO_MAPEADA">⚠️ Não Mapeada (Alerta de Inconsistência)</option>
                              {BASES_SGP_SISTEMA.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.id} — {b.nome}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {naoMapeada ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                Não Mapeada
                              </span>
                            ) : s.confirmado ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Homologada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Sugestão Automática
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-[11px] text-[#5B6474]">
                            <div>{s.atualizadoEm}</div>
                            <div className="text-[10px] text-[#98A2B3]">{s.atualizadoPor}</div>
                          </td>

                          <td className="py-3 px-4 text-right">
                            {!s.confirmado && !naoMapeada && (
                              <button
                                onClick={() => handleVincularSecao(s.codigoSecao, s.unidadeId)}
                                className="px-3 py-1 rounded bg-[#1F4FD1] hover:bg-[#163CA8] text-white font-semibold text-[11px] transition-colors shadow-xs"
                              >
                                Homologar
                              </button>
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

          {/* Card 2: Catálogo de Horários Detectados */}
          <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-xs overflow-hidden">
            <div className="p-5 border-b border-[#E3E6EB] space-y-1">
              <h3 className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#1F4FD1]" />
                <span>Catálogo de Horários e Escalas Detectados (RM/TOTVS)</span>
              </h3>
              <p className="text-xs text-[#5B6474]">
                Jornadas e escalas contratuais identificadas automaticamente na importação de funcionários do RM.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                    <th className="py-3 px-4">Código Horário</th>
                    <th className="py-3 px-4">Descrição da Escala</th>
                    <th className="py-3 px-4">Jornada Semanal</th>
                    <th className="py-3 px-4">Primeira Detecção</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6EB]">
                  {catalogoHorarios.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[#5B6474]">
                        Nenhum horário cadastrado ainda. Será registrado automaticamente no próximo lote importado.
                      </td>
                    </tr>
                  ) : (
                    catalogoHorarios.map((h) => (
                      <tr key={h.codigo} className="hover:bg-[#F9FAFB]">
                        <td className="py-3 px-4 font-mono font-bold text-[#1A2230]">
                          {h.codigo}
                        </td>
                        <td className="py-3 px-4 font-medium text-[#344054]">
                          {h.descricao}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-mono font-bold text-[10px]">
                            {h.jornada ? `${h.jornada}h` : "Padrão Contrato"}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-[11px] text-[#5B6474] font-mono">
                          {h.primeiraOcorrenciaEm}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAIS */}
      {/* ===================================================================== */}

      {/* MODAL 1: NOVO USUÁRIO */}
      {modalNovoUsuario && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E3E6EB] space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-bold text-[#1A2230]">
                Cadastrar Novo Usuário Corporativo
              </h3>
              <button
                onClick={() => setModalNovoUsuario(false)}
                className="text-[#98A2B3] hover:text-[#344054] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCriarUsuario} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Nome Completo:
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Roberta Dias"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  E-mail Corporativo:
                </label>
                <input
                  type="email"
                  required
                  placeholder="roberta.dias@premierlogistics.com.br"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1">
                    Empresa:
                  </label>
                  <select
                    value={formEmpresa}
                    onChange={(e) => setFormEmpresa(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB]"
                  >
                    <option value="Premier Logistics">Premier Logistics</option>
                    <option value="Petróleo Brasileiro S.A. – Petrobras">Petrobras</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#344054] mb-1">
                    Tipo de Conta:
                  </label>
                  <select
                    value={formTipoConta}
                    onChange={(e) => setFormTipoConta(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB]"
                  >
                    <option value="LOCAL">Conta Local</option>
                    <option value="SSO_MICROSOFT">SSO Microsoft Entra</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Perfil de Acesso (RBAC):
                </label>
                <select
                  value={formPerfil}
                  onChange={(e) => setFormPerfil(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB]"
                >
                  {Object.entries(NOMES_PERFIS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#344054] mb-1">
                  Cargo / Função:
                </label>
                <input
                  type="text"
                  placeholder="Ex: Engenheiro de Fiscalização"
                  value={formCargo}
                  onChange={(e) => setFormCargo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB]"
                />
              </div>

              <div className="pt-3 border-t border-[#E3E6EB] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoUsuario(false)}
                  className="px-4 py-2 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163CA8] rounded-lg shadow-xs"
                >
                  Confirmar Cadastro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDITAR PERFIL */}
      {modalEditarPerfil && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E3E6EB] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-bold text-[#1A2230]">
                Editar Perfil de Acesso
              </h3>
              <button
                onClick={() => setModalEditarPerfil(null)}
                className="text-[#98A2B3] hover:text-[#344054] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#5B6474]">
              Alterando perfil de <strong>{modalEditarPerfil.nome}</strong> ({modalEditarPerfil.email}).
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#344054]">
                Novo Perfil:
              </label>
              <select
                value={novoPerfilSelecionado}
                onChange={(e) => setNovoPerfilSelecionado(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-[#F9FAFB]"
              >
                {Object.entries(NOMES_PERFIS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-[#E3E6EB] flex items-center justify-end gap-2">
              <button
                onClick={() => setModalEditarPerfil(null)}
                className="px-4 py-2 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarPerfil}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163CA8] rounded-lg shadow-xs"
              >
                Salvar Novo Perfil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VINCULAR BASES */}
      {modalVincularBases && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E3E6EB] space-y-4">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-bold text-[#1A2230]">
                Vincular Bases Territoriais
              </h3>
              <button
                onClick={() => setModalVincularBases(null)}
                className="text-[#98A2B3] hover:text-[#344054] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#5B6474]">
              Defina as bases que <strong>{modalVincularBases.nome}</strong> pode visualizar e gerenciar. Os dados em todo o sistema respeitarão esse vínculo estrito:
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {BASES_DISPONIVEIS.map((b) => {
                const selecionada = basesSelecionadas.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F9FAFB] cursor-pointer text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={selecionada}
                      onChange={(e) => {
                        if (b.id === "TODAS") {
                          setBasesSelecionadas(e.target.checked ? ["TODAS"] : []);
                        } else {
                          const semTodas = basesSelecionadas.filter((x) => x !== "TODAS");
                          if (e.target.checked) {
                            setBasesSelecionadas([...semTodas, b.id]);
                          } else {
                            setBasesSelecionadas(semTodas.filter((x) => x !== b.id));
                          }
                        }
                      }}
                      className="rounded text-[#1F4FD1]"
                    />
                    <span className="font-semibold text-[#1A2230]">{b.nome}</span>
                  </label>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#E3E6EB] flex items-center justify-end gap-2">
              <button
                onClick={() => setModalVincularBases(null)}
                className="px-4 py-2 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarBases}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163CA8] rounded-lg shadow-xs"
              >
                Salvar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
