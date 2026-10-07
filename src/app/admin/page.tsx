"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Settings,
  Users,
  ShieldCheck,
  AlertCircle,
  FileSpreadsheet,
  UploadCloud,
  ArrowRight,
  Search,
  Plus,
  Edit2,
  MapPin,
  KeyRound,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertTriangle,
  X,
  Save,
  Building,
  Check,
  RotateCcw,
  Database,
} from "lucide-react";
import { AbaLimpezaDados } from "@/components/admin/aba-limpeza-dados";
import {
  carregarUsuarios,
  criarUsuario,
  atualizarPerfilUsuario,
  atualizarBasesUsuario,
  alterarStatusUsuario,
  redefinirSenhaLocal,
  excluirUsuario,
  ehUltimoAdminAtivo,
  registrarLogAuditoriaAdmin,
} from "@/lib/auth/usuarios";
import {
  obterParametrosContrato,
  salvarParametrosContrato,
} from "@/lib/auth/parametros";
import {
  NOMES_PERFIS,
  can,
} from "@/lib/auth/permissoes";
import {
  UsuarioCadastro,
  UsuarioSessao,
  PerfilUsuario,
  TipoConta,
  ParametrosContrato,
} from "@/lib/auth/tipos";
import {
  carregarMapeamentosSecao,
  vincularSecaoBase,
  MapeamentoSecao,
  BASES_SGP_SISTEMA,
} from "@/lib/dados/secoes-horarios";
import AcessoNegadoPage from "../acesso-negado/page";

type AbaAdmin = "USUARIOS" | "PARAMETROS" | "SECOES" | "LIMPEZA";

const BASES_DISPONIVEIS = [
  { id: "TODAS", nome: "Todas as Bases Contratuais" },
  { id: "UFN-III", nome: "UFN III – Três Lagoas/MS" },
  { id: "MACAE", nome: "Macaé / Parque de Tubos" },
  { id: "SANTOS", nome: "Terminal Santos/SP" },
  { id: "PAULINIA", nome: "Refinaria Paulínia (Replan)" },
];

const SESSAO_PADRAO_DEV: UsuarioSessao = {
  id: "usr-admin-01",
  nome: "Administrador Premier",
  email: "admin.sgp@premierlogistics.com.br",
  empresa: "Premier Logistics",
  perfil: "PREMIER_ADMIN",
  status: "ATIVO",
  tipoConta: "LOCAL",
  basesVinculadas: ["TODAS"],
  cargo: "Administrador de Sistemas",
};

export default function AdminPage() {
  const [abaAtiva, setAbaAtiva] = useState<AbaAdmin>("USUARIOS");
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [carregandoSessao, setCarregandoSessao] = useState(true);

  // Dados essenciais
  const [usuarios, setUsuarios] = useState<UsuarioCadastro[]>([]);
  const [parametros, setParametros] = useState<ParametrosContrato>(obterParametrosContrato());
  const [secoes, setSecoes] = useState<MapeamentoSecao[]>([]);
  const [mensagemSucesso, setMensagemSucesso] = useState<string>("");
  const [mensagemErro, setMensagemErro] = useState<string>("");

  // Filtros
  const [busca, setBusca] = useState("");
  const [buscaSecao, setBuscaSecao] = useState("");

  // Modais
  const [modalNovoUsuario, setModalNovoUsuario] = useState(false);
  const [modalEditarPerfil, setModalEditarPerfil] = useState<UsuarioCadastro | null>(null);
  const [modalVincularBases, setModalVincularBases] = useState<UsuarioCadastro | null>(null);
  const [modalExcluirUsuario, setModalExcluirUsuario] = useState<UsuarioCadastro | null>(null);

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

  // Form Parâmetros
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
      setSecoes(carregarMapeamentosSecao());
    };

    carregarTudo();

    const sincronizar = () => {
      setUsuarios(carregarUsuarios());
      setParametros(obterParametrosContrato());
      setSecoes(carregarMapeamentosSecao());
    };

    window.addEventListener("sgp-usuarios-atualizados", sincronizar);
    window.addEventListener("sgp-parametros-atualizados", sincronizar);
    window.addEventListener("sgp-secoes-atualizadas", sincronizar);

    return () => {
      window.removeEventListener("sgp-usuarios-atualizados", sincronizar);
      window.removeEventListener("sgp-parametros-atualizados", sincronizar);
      window.removeEventListener("sgp-secoes-atualizadas", sincronizar);
    };
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

  // Filtragem de Usuários
  const usuariosFiltrados = useMemo(() => {
    const termo = busca.toLowerCase().trim();
    if (!termo) return usuarios;
    return usuarios.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo) ||
        u.cargo?.toLowerCase().includes(termo)
    );
  }, [usuarios, busca]);

  // Filtragem de Seções
  const secoesFiltradas = useMemo(() => {
    const termo = buscaSecao.toLowerCase().trim();
    if (!termo) return secoes;
    return secoes.filter(
      (s) =>
        s.codigoSecao.toLowerCase().includes(termo) ||
        s.descricaoSecao.toLowerCase().includes(termo) ||
        (s.unidadeId && s.unidadeId.toLowerCase().includes(termo))
    );
  }, [secoes, buscaSecao]);

  // Verificação de permissão
  if (!carregandoSessao && (!sessao || !can(sessao, "LER", "ADMINISTRACAO"))) {
    return <AcessoNegadoPage />;
  }

  // Handlers de Usuários
  const handleCriarUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    const executorSessao = sessao || SESSAO_PADRAO_DEV;

    try {
      const novo = criarUsuario(
        {
          nome: formNome.trim(),
          email: formEmail.trim(),
          empresa: formEmpresa,
          perfil: formPerfil,
          status: "ATIVO",
          tipoConta: formTipoConta,
          basesVinculadas: formBases,
          cargo: formCargo.trim() || undefined,
        },
        executorSessao
      );

      setUsuarios(carregarUsuarios());
      setModalNovoUsuario(false);
      setFormNome("");
      setFormEmail("");
      setFormCargo("");
      setFormPerfil("PREMIER_GESTOR");
      setFormBases(["TODAS"]);
      exibirAlerta(`Usuário ${novo.nome} cadastrado com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao cadastrar usuário";
      exibirAlerta(msg, true);
    }
  };

  const handleSalvarPerfil = () => {
    if (!modalEditarPerfil) return;
    const executorSessao = sessao || SESSAO_PADRAO_DEV;

    try {
      atualizarPerfilUsuario(modalEditarPerfil.id, novoPerfilSelecionado, executorSessao);
      setUsuarios(carregarUsuarios());
      setModalEditarPerfil(null);
      exibirAlerta(`Perfil de ${modalEditarPerfil.nome} atualizado para ${NOMES_PERFIS[novoPerfilSelecionado]} com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar perfil";
      exibirAlerta(msg, true);
    }
  };

  const handleSalvarBases = () => {
    if (!modalVincularBases) return;
    const executorSessao = sessao || SESSAO_PADRAO_DEV;

    try {
      const bases = basesSelecionadas.length === 0 ? ["TODAS"] : basesSelecionadas;
      atualizarBasesUsuario(modalVincularBases.id, bases, executorSessao);
      setUsuarios(carregarUsuarios());
      setModalVincularBases(null);
      exibirAlerta(`Bases vinculadas de ${modalVincularBases.nome} atualizadas com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao vincular bases";
      exibirAlerta(msg, true);
    }
  };

  const handleAlternarStatus = (u: UsuarioCadastro) => {
    const executorSessao = sessao || SESSAO_PADRAO_DEV;
    const novoStatus = u.status === "ATIVO" ? "INATIVO" : "ATIVO";

    try {
      alterarStatusUsuario(u.id, novoStatus, executorSessao);
      setUsuarios(carregarUsuarios());
      exibirAlerta(`Usuário ${u.nome} foi ${novoStatus === "ATIVO" ? "ativado" : "inativado"} com sucesso.`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao alterar status do usuário";
      exibirAlerta(msg, true);
    }
  };

  const handleRedefinirSenha = (u: UsuarioCadastro) => {
    const executorSessao = sessao || SESSAO_PADRAO_DEV;

    try {
      const novaSenha = redefinirSenhaLocal(u.id, executorSessao);
      exibirAlerta(`Senha temporária para ${u.nome}: ${novaSenha}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao redefinir senha";
      exibirAlerta(msg, true);
    }
  };

  const handleAbrirModalExcluir = (u: UsuarioCadastro) => {
    if (sessao?.id === u.id) {
      exibirAlerta("Não é permitido excluir a própria conta logada.", true);
      return;
    }
    if (ehUltimoAdminAtivo(u.id)) {
      exibirAlerta("Operação bloqueada: não é permitido remover o único Administrador Premier ativo.", true);
      return;
    }
    setModalExcluirUsuario(u);
  };

  const handleConfirmarExclusao = () => {
    if (!modalExcluirUsuario) return;
    const executorSessao = sessao || SESSAO_PADRAO_DEV;

    try {
      excluirUsuario(modalExcluirUsuario.id, executorSessao);
      setUsuarios(carregarUsuarios());
      const nomeRemovido = modalExcluirUsuario.nome;
      setModalExcluirUsuario(null);
      exibirAlerta(`Usuário "${nomeRemovido}" excluído com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao excluir usuário";
      exibirAlerta(msg, true);
    }
  };

  // Handler de Parâmetros
  const handleSalvarParametros = (e: React.FormEvent) => {
    e.preventDefault();
    const executorSessao = sessao || SESSAO_PADRAO_DEV;

    try {
      const glosaNum = formFatorGlosa.trim() === "" ? null : parseFloat(formFatorGlosa.replace(",", "."));
      const prazoStr = formPrazoFechamento.trim() === "" ? null : formPrazoFechamento.trim();
      const metaNum = formMetaSla.trim() === "" ? 95.0 : parseFloat(formMetaSla.replace(",", "."));

      const atualizado = salvarParametrosContrato(
        {
          fatorGlosa: glosaNum,
          prazoFechamento: prazoStr,
          metaSla: metaNum,
        },
        executorSessao.nome
      );

      setParametros(atualizado);

      registrarLogAuditoriaAdmin(
        executorSessao,
        "ALTERAR_PARAMETROS_CONTRATO",
        "PARAMETRO_CONTRATO",
        "param-contrato-icj",
        "Atualização de parâmetros contratuais de glosa e medição",
        null,
        `Glosa: ${atualizado.fatorGlosa ?? "N/D"} | Prazo: ${atualizado.prazoFechamento ?? "N/D"} | SLA: ${atualizado.metaSla}%`
      );

      exibirAlerta("Parâmetros contratuais atualizados com sucesso!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar parâmetros";
      exibirAlerta(msg, true);
    }
  };

  // Handler de Seções
  const handleVincularSecao = (codigoSecao: string, baseId: string) => {
    const executorSessao = sessao || SESSAO_PADRAO_DEV;

    try {
      vincularSecaoBase(codigoSecao, baseId, true, executorSessao.nome);
      setSecoes(carregarMapeamentosSecao());
      registrarLogAuditoriaAdmin(
        executorSessao,
        "MAPEAMENTO_SECAO",
        "SECAO",
        codigoSecao,
        `Vínculo da seção RM ${codigoSecao} para a base ${baseId}`,
        null,
        `Base: ${baseId}`
      );
      exibirAlerta(`Seção ${codigoSecao} vinculada à base ${baseId} com sucesso!`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao vincular seção";
      exibirAlerta(msg, true);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Topo Limpo e Objetivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E3E6EB]">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#5B6474] font-medium mb-1">
            <span className="font-semibold text-[#1F4FD1]">Premier Logistics</span>
            <span>/</span>
            <span className="text-[#1A2230] font-semibold">Administração</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1A2230] tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#0F1E36] text-white flex items-center justify-center shadow-2xs">
              <Settings className="w-4 h-4 text-emerald-400" />
            </div>
            <span>Administração do Sistema</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6474] mt-0.5">
            Gestão de usuários e permissões territoriais, parâmetros do contrato e mapeamento de seções RM.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-white text-slate-700 border border-slate-200 shadow-2xs">
            <ShieldCheck className="w-3.5 h-3.5 text-slate-800" />
            Administrador Premier
          </span>
        </div>
      </div>

      {/* Alertas */}
      {mensagemSucesso && (
        <div className="p-3.5 rounded-xl bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{mensagemSucesso}</span>
        </div>
      )}

      {mensagemErro && (
        <div className="p-3.5 rounded-xl bg-white border border-rose-300 text-rose-800 text-xs font-semibold flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{mensagemErro}</span>
        </div>
      )}

      {/* Navegação por Abas Essenciais */}
      <div className="flex items-center gap-1 border-b border-[#E3E6EB] overflow-x-auto pb-px">
        <button
          onClick={() => setAbaAtiva("USUARIOS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            abaAtiva === "USUARIOS"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-white"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Usuários ({usuarios.length})</span>
        </button>

        <button
          onClick={() => setAbaAtiva("PARAMETROS")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            abaAtiva === "PARAMETROS"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-white"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Parâmetros do Contrato</span>
        </button>

        <button
          onClick={() => setAbaAtiva("SECOES")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            abaAtiva === "SECOES"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-white"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Mapeamento de Seções RM</span>
        </button>

        <button
          onClick={() => setAbaAtiva("LIMPEZA")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all shrink-0 cursor-pointer ${
            abaAtiva === "LIMPEZA"
              ? "border-[#1F4FD1] text-[#1F4FD1] bg-white"
              : "border-transparent text-[#5B6474] hover:text-[#1A2230]"
          }`}
        >
          <Database className="w-4 h-4 text-emerald-600" />
          <span>Limpeza & Backups (MOMENTO 1)</span>
        </button>

        <Link
          href="/admin/importar-funcionarios"
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 border-transparent text-blue-700 hover:text-blue-900 bg-blue-50/70 hover:bg-blue-100/70 rounded-t-lg transition-all shrink-0 ml-auto"
        >
          <UploadCloud className="w-4 h-4 text-blue-600" />
          <span>Importar Funcionários (RM)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ===================================================================== */}
      {/* ABA 1: USUÁRIOS */}
      {/* ===================================================================== */}
      {abaAtiva === "USUARIOS" && (
        <div className="space-y-4">
          {/* Barra de Ações: Busca e Botão Novo Usuário */}
          <div className="bg-white p-3.5 rounded-xl border border-[#E3E6EB] shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#98A2B3]" />
              <input
                type="text"
                placeholder="Buscar por nome, e-mail ou cargo..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              {busca && (
                <button
                  onClick={() => setBusca("")}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600"
                  title="Limpar busca"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              onClick={() => setModalNovoUsuario(true)}
              className="h-8 inline-flex items-center justify-center gap-1.5 px-4 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Novo Usuário</span>
            </button>
          </div>

          {/* Tabela Limpa de Usuários */}
          <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                    <th className="py-3 px-4">Nome e Cargo</th>
                    <th className="py-3 px-4">E-mail Corporativo</th>
                    <th className="py-3 px-4">Perfil de Acesso</th>
                    <th className="py-3 px-4">Bases Vinculadas</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6EB]">
                  {usuariosFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-[#5B6474]">
                        Nenhum usuário encontrado.
                      </td>
                    </tr>
                  ) : (
                    usuariosFiltrados.map((u) => {
                      const isSelf = sessao?.id === u.id;
                      const ehUltimoAdmin = ehUltimoAdminAtivo(u.id);

                      return (
                        <tr key={u.id} className="hover:bg-[#F9FAFB] transition-colors">
                          {/* Nome e Cargo */}
                          <td className="py-3 px-4 font-semibold text-[#1A2230]">
                            <div className="flex items-center gap-1.5">
                              <span>{u.nome}</span>
                              {isSelf && (
                                <span className="text-[11px] text-[#5B6474] font-normal">
                                  (Você)
                                </span>
                              )}
                            </div>
                            {u.cargo && (
                              <span className="text-[11px] text-[#5B6474] block font-normal">
                                {u.cargo}
                              </span>
                            )}
                          </td>

                          {/* E-mail */}
                          <td className="py-3 px-4 text-[#5B6474] font-mono text-[11px]">
                            {u.email}
                          </td>

                          {/* Perfil */}
                          <td className="py-3 px-4 text-xs font-medium text-[#1A2230]">
                            {NOMES_PERFIS[u.perfil] || u.perfil}
                          </td>

                          {/* Bases Vinculadas */}
                          <td className="py-3 px-4 text-xs text-[#344054]">
                            {u.basesVinculadas.join(", ")}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                                u.status === "ATIVO" ? "text-emerald-700" : "text-rose-700"
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  u.status === "ATIVO" ? "bg-emerald-500" : "bg-rose-500"
                                }`}
                              />
                              {u.status === "ATIVO" ? "Ativo" : "Inativo"}
                            </span>
                          </td>

                          {/* Ações */}
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center gap-1">
                              {/* Editar Perfil */}
                              <button
                                onClick={() => {
                                  setModalEditarPerfil(u);
                                  setNovoPerfilSelecionado(u.perfil);
                                }}
                                disabled={isSelf}
                                className="h-7 px-2 rounded-md hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                title={isSelf ? "Não é permitido alterar o próprio perfil" : "Editar perfil de acesso"}
                              >
                                <Edit2 className="w-3.5 h-3.5 text-slate-500" />
                                <span>Perfil</span>
                              </button>

                              {/* Vincular Bases */}
                              <button
                                onClick={() => {
                                  setModalVincularBases(u);
                                  setBasesSelecionadas(u.basesVinculadas);
                                }}
                                className="h-7 px-2 rounded-md hover:bg-slate-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                title="Vincular bases territoriais Petrobras"
                              >
                                <MapPin className="w-3.5 h-3.5 text-slate-500" />
                                <span>Bases</span>
                              </button>

                              {/* Redefinir Senha */}
                              {u.tipoConta === "LOCAL" && (
                                <button
                                  onClick={() => handleRedefinirSenha(u)}
                                  className="h-7 px-2 rounded-md hover:bg-amber-50 text-xs font-medium text-amber-700 inline-flex items-center gap-1 transition-colors cursor-pointer"
                                  title="Redefinir senha da conta local"
                                >
                                  <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                                  <span>Senha</span>
                                </button>
                              )}

                              {/* Ativar / Inativar */}
                              <button
                                onClick={() => handleAlternarStatus(u)}
                                disabled={ehUltimoAdmin}
                                className={`h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer ${
                                  u.status === "ATIVO" ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50"
                                }`}
                                title={
                                  ehUltimoAdmin
                                    ? "Não é permitido inativar o último Administrador Premier"
                                    : u.status === "ATIVO"
                                    ? "Inativar usuário"
                                    : "Ativar usuário"
                                }
                              >
                                {u.status === "ATIVO" ? (
                                  <>
                                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Inativar</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                    <span>Ativar</span>
                                  </>
                                )}
                              </button>

                              {/* Excluir Definitivamente */}
                              <button
                                onClick={() => handleAbrirModalExcluir(u)}
                                disabled={isSelf || ehUltimoAdmin}
                                className="h-7 w-7 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600 inline-flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                title={
                                  isSelf
                                    ? "Não é permitido excluir a própria conta"
                                    : ehUltimoAdmin
                                    ? "Não é permitido remover o último Administrador"
                                    : "Excluir definitivamente"
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3 border-t border-[#E3E6EB] bg-[#F8F9FC] text-xs text-[#5B6474]">
              Exibindo <strong>{usuariosFiltrados.length}</strong> de <strong>{usuarios.length}</strong> usuários cadastrados.
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 2: PARÂMETROS DO CONTRATO */}
      {/* ===================================================================== */}
      {abaAtiva === "PARAMETROS" && (
        <div className="bg-white p-6 rounded-xl border border-[#E3E6EB] shadow-2xs space-y-6 max-w-3xl">
          <div className="border-b border-[#E3E6EB] pb-4">
            <h3 className="text-sm font-bold text-[#1A2230]">
              Parâmetros Contratuais Petrobras — ICJ 5900.0129796.25.2
            </h3>
            <p className="text-xs text-[#5B6474] mt-0.5">
              Configurações centrais do contrato utilizadas para apuração de conformidade, cálculo de glosas e prazos de medição mensal.
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
                placeholder="Ex: 1.0"
                value={formFatorGlosa}
                onChange={(e) => setFormFatorGlosa(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              <p className="text-[11px] text-[#667085]">
                Multiplicador aplicado sobre o valor do posto-dia em casos de falta sem cobertura contratual.
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
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              <p className="text-[11px] text-[#667085]">
                Data limite para validação e emissão do boletim de medição mensal.
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
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
              <p className="text-[11px] text-[#667085]">
                Percentual mínimo de ocupação e conformidade exigido pelo contrato.
              </p>
            </div>

            <div className="pt-4 border-t border-[#E3E6EB] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-[11px] text-[#5B6474]">
                Última alteração: {new Date(parametros.atualizadoEm).toLocaleString("pt-BR")} por {parametros.atualizadoPor}
              </div>

              <button
                type="submit"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-2xs transition-all cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Parâmetros</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 3: MAPEAMENTO DE SEÇÕES RM */}
      {/* ===================================================================== */}
      {abaAtiva === "SECOES" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-[#E3E6EB] shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
                <Building className="w-4 h-4 text-[#1F4FD1]" />
                <span>Mapeamento de Seções Organizacionais RM/TOTVS → Bases SGP</span>
              </h3>
              <p className="text-xs text-[#5B6474] mt-0.5">
                Vínculo necessário para alocar colaboradores importados do RM às respectivas bases contratuais Petrobras.
              </p>
            </div>

            <div className="relative min-w-[240px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#98A2B3]" />
              <input
                type="text"
                placeholder="Buscar por código ou descrição..."
                value={buscaSecao}
                onChange={(e) => setBuscaSecao(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E3E6EB] shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8F9FC] border-b border-[#E3E6EB] text-[#5B6474] font-semibold">
                    <th className="py-3 px-4">Código Seção RM</th>
                    <th className="py-3 px-4">Descrição no RM / TOTVS</th>
                    <th className="py-3 px-4 min-w-[260px]">Base SGP Vinculada</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E6EB]">
                  {secoesFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-[#5B6474]">
                        Nenhuma seção encontrada.
                      </td>
                    </tr>
                  ) : (
                    secoesFiltradas.map((s) => {
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
                              className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-[#D0D5DD] bg-white text-[#344054] font-medium focus:ring-2 focus:ring-[#1F4FD1] focus:outline-none cursor-pointer"
                            >
                              <option value="NAO_MAPEADA">⚠️ Não Mapeada</option>
                              {BASES_SGP_SISTEMA.map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.id} — {b.nome}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td className="py-3 px-4 text-center">
                            {naoMapeada ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                Não Mapeada
                              </span>
                            ) : s.confirmado ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                Homologada
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Sugestão Automática
                              </span>
                            )}
                          </td>

                          <td className="py-3 px-4 text-right">
                            {!s.confirmado && !naoMapeada && (
                              <button
                                onClick={() => handleVincularSecao(s.codigoSecao, s.unidadeId)}
                                className="h-7 px-2.5 rounded-md hover:bg-slate-100 text-xs font-semibold text-[#1F4FD1] inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Check className="w-3.5 h-3.5 text-[#1F4FD1]" />
                                <span>Homologar</span>
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

            <div className="p-3 border-t border-[#E3E6EB] bg-[#F8F9FC] text-xs text-[#5B6474]">
              Total de <strong>{secoes.length}</strong> seções RM cadastradas no sistema.
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA 4: LIMPEZA DE DADOS FICTÍCIOS & BACKUPS (MOMENTO 1) */}
      {/* ===================================================================== */}
      {abaAtiva === "LIMPEZA" && (
        <AbaLimpezaDados
          usuarioNome={sessao?.nome || SESSAO_PADRAO_DEV.nome}
          onNotificar={exibirAlerta}
        />
      )}

      {/* ===================================================================== */}
      {/* MODAIS ESSENCIAIS */}
      {/* ===================================================================== */}

      {/* MODAL 1: NOVO USUÁRIO */}
      {modalNovoUsuario && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-[#E3E6EB] space-y-5 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-bold text-[#1A2230]">
                Cadastrar Novo Usuário
              </h3>
              <button
                onClick={() => setModalNovoUsuario(false)}
                className="text-[#98A2B3] hover:text-[#344054] p-1 cursor-pointer"
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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1]"
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
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#344054] cursor-pointer"
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
                    className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#344054] cursor-pointer"
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
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#344054] cursor-pointer"
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
                  placeholder="Ex: Supervisor Operacional"
                  value={formCargo}
                  onChange={(e) => setFormCargo(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#1A2230]"
                />
              </div>

              <div className="pt-3 border-t border-[#E3E6EB] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalNovoUsuario(false)}
                  className="h-8 px-4 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-8 px-4 text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163CA8] rounded-lg shadow-2xs transition-colors cursor-pointer"
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
                className="text-[#98A2B3] hover:text-[#344054] p-1 cursor-pointer"
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
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] bg-white text-[#344054] cursor-pointer"
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
                className="h-8 px-4 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarPerfil}
                className="h-8 px-4 text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163CA8] rounded-lg shadow-2xs transition-colors cursor-pointer"
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
                className="text-[#98A2B3] hover:text-[#344054] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-[#5B6474]">
              Defina as bases que <strong>{modalVincularBases.nome}</strong> pode visualizar e gerenciar:
            </div>

            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {BASES_DISPONIVEIS.map((b) => {
                const selecionada = basesSelecionadas.includes(b.id);
                return (
                  <label
                    key={b.id}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-[#F9FAFB] cursor-pointer text-xs border border-transparent hover:border-slate-200"
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
                      className="rounded text-[#1F4FD1] focus:ring-[#1F4FD1]"
                    />
                    <span className="font-semibold text-[#1A2230]">{b.nome}</span>
                  </label>
                );
              })}
            </div>

            <div className="pt-3 border-t border-[#E3E6EB] flex items-center justify-end gap-2">
              <button
                onClick={() => setModalVincularBases(null)}
                className="h-8 px-4 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvarBases}
                className="h-8 px-4 text-xs font-semibold text-white bg-[#1F4FD1] hover:bg-[#163CA8] rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Salvar Vínculo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: CONFIRMAR EXCLUSÃO DE USUÁRIO */}
      {modalExcluirUsuario && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-[#E3E6EB] space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b border-[#E3E6EB] pb-3">
              <h3 className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600" />
                <span>Confirmar Exclusão de Cadastro</span>
              </h3>
              <button
                onClick={() => setModalExcluirUsuario(null)}
                className="text-[#98A2B3] hover:text-[#344054] p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#5B6474]">
              <p>
                Deseja realmente remover o usuário abaixo? O acesso ao sistema será revogado imediatamente:
              </p>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="font-bold text-sm text-[#1A2230]">{modalExcluirUsuario.nome}</div>
                <div className="font-mono text-xs text-[#5B6474]">{modalExcluirUsuario.email}</div>
                <div className="text-xs text-slate-700 pt-1">
                  Perfil: <span className="font-semibold">{NOMES_PERFIS[modalExcluirUsuario.perfil] || modalExcluirUsuario.perfil}</span>
                </div>
              </div>
              <p className="text-[11px] text-rose-600 font-medium">
                Esta ação é irreversível e revoga permanentemente as credenciais do usuário.
              </p>
            </div>

            <div className="pt-3 border-t border-[#E3E6EB] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalExcluirUsuario(null)}
                className="h-8 px-4 text-xs font-medium text-[#5B6474] hover:bg-[#F2F4F7] rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                className="h-8 px-4 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-2xs transition-colors cursor-pointer"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
