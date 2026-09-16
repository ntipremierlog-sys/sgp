"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Settings,
  Users,
  UserPlus,
  RotateCcw,
  CheckCircle2,
  X,
  Trash2,
  Search,
  Building2,
  Briefcase,
} from "lucide-react";
import {
  carregarEstado,
  resetarDadosParaPadrao,
} from "@/lib/dados/estado-operacional";

interface UsuarioGovernance {
  id: string;
  nome: string;
  email: string;
  empresa: "Petróleo Brasileiro S.A. – Petrobras" | "Premier Logistics";
  perfil: string;
  unidade: string;
  status: "ATIVO" | "INATIVO" | "BLOQUEADO" | "PENDENTE";
  totp: boolean;
  autorizadoPor: string;
}

const CHAVE_STORAGE_USUARIOS = "sgp_usuarios_governance_v1";

const PERFIS_NOMES: Record<string, { titulo: string; area: string }> = {
  PETROBRAS_FISCAL: { titulo: "Fiscal Técnico", area: "Fiscalização UFN III" },
  PETROBRAS_GESTOR: { titulo: "Gestor do Contrato", area: "Gestão Petrobras" },
  PREMIER_GESTOR_CONTRATO: { titulo: "Gestor Geral", area: "Operações Premier" },
  PREMIER_SUPERVISOR: { titulo: "Supervisor de Campo", area: "Supervisão Operacional" },
  PREMIER_RH: { titulo: "Recursos Humanos", area: "Gestão de Pessoal" },
  PREMIER_ADMIN: { titulo: "Administrador Master", area: "Governança & TI" },
};

const USUARIOS_INICIAIS: UsuarioGovernance[] = [
  {
    id: "usr-01",
    nome: "Carlos Eduardo Mendes",
    email: "carlos.mendes@petrobras.com.br",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    perfil: "PETROBRAS_FISCAL",
    unidade: "UFN III – Três Lagoas/MS",
    status: "ATIVO",
    totp: true,
    autorizadoPor: "Gerência de Contratos Petrobras",
  },
  {
    id: "usr-02",
    nome: "Mariana Albuquerque",
    email: "mariana.albuquerque@petrobras.com.br",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    perfil: "PETROBRAS_GESTOR",
    unidade: "Todas as Unidades",
    status: "ATIVO",
    totp: true,
    autorizadoPor: "Diretoria de Suprimentos Petrobras",
  },
  {
    id: "usr-03",
    nome: "Marcos Valério de Souza",
    email: "marcos.valerio@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_GESTOR_CONTRATO",
    unidade: "Todas as Unidades",
    status: "ATIVO",
    totp: true,
    autorizadoPor: "Diretoria de Operações Premier",
  },
  {
    id: "usr-04",
    nome: "Renato Silva",
    email: "renato.silva@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_SUPERVISOR",
    unidade: "UFN III – Três Lagoas/MS",
    status: "ATIVO",
    totp: true,
    autorizadoPor: "Gestão do Contrato",
  },
  {
    id: "usr-05",
    nome: "Fabiana Ribeiro",
    email: "fabiana.ribeiro@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_RH",
    unidade: "Todas as Unidades",
    status: "ATIVO",
    totp: true,
    autorizadoPor: "Diretoria de RH",
  },
  {
    id: "usr-06",
    nome: "Administrador Premier",
    email: "admin.sgp@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_ADMIN",
    unidade: "Todas as Unidades",
    status: "ATIVO",
    totp: true,
    autorizadoPor: "TI Corporativa Premier",
  },
];

function obterIniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function AdminPage() {
  const [usuarios, setUsuarios] = useState<UsuarioGovernance[]>(USUARIOS_INICIAIS);
  const [perfilAtual, setPerfilAtual] = useState("PREMIER_ADMIN");
  const [modalConcessaoAberto, setModalConcessaoAberto] = useState(false);
  const [mensagem, setMensagem] = useState("");

  // Filtros modernos
  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState<"TODAS" | "PETROBRAS" | "PREMIER">("TODAS");
  const [filtroStatus, setFiltroStatus] = useState<"TODOS" | "ATIVO" | "BLOQUEADO">("TODOS");

  // Formulário de convite/novo usuário
  const [formNome, setFormNome] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formEmpresa, setFormEmpresa] = useState<UsuarioGovernance["empresa"]>("Premier Logistics");
  const [formPerfil, setFormPerfil] = useState("PREMIER_SUPERVISOR");
  const [formUnidade, setFormUnidade] = useState("UFN III – Três Lagoas/MS");

  useEffect(() => {
    const estado = carregarEstado();
    setPerfilAtual(estado.perfilAtivo);

    if (typeof window !== "undefined") {
      const salvos = localStorage.getItem(CHAVE_STORAGE_USUARIOS);
      if (salvos) {
        try {
          const parsed = JSON.parse(salvos);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setUsuarios(parsed);
          }
        } catch (e) {
          console.error("Erro ao carregar usuários salvos:", e);
        }
      }
    }

    const handleAtualizacao = () => {
      const e = carregarEstado();
      setPerfilAtual(e.perfilAtivo);
    };
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const ehPremierAdmin = perfilAtual === "PREMIER_ADMIN";

  const atualizarUsuarios = (novosUsuarios: UsuarioGovernance[]) => {
    setUsuarios(novosUsuarios);
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAVE_STORAGE_USUARIOS, JSON.stringify(novosUsuarios));
    }
  };

  // Restrição de visualização caso não seja PREMIER_ADMIN
  const usuariosPermitidos = useMemo(() => {
    return ehPremierAdmin
      ? usuarios
      : usuarios.filter((u) => u.perfil === perfilAtual);
  }, [usuarios, ehPremierAdmin, perfilAtual]);

  // Filtro dinâmico por busca, empresa e status
  const usuariosFiltrados = useMemo(() => {
    return usuariosPermitidos.filter((u) => {
      const termo = busca.toLowerCase();
      const matchBusca =
        !busca ||
        u.nome.toLowerCase().includes(termo) ||
        u.email.toLowerCase().includes(termo) ||
        u.perfil.toLowerCase().includes(termo);

      const matchEmpresa =
        filtroEmpresa === "TODAS" ||
        (filtroEmpresa === "PETROBRAS" && u.empresa.includes("Petrobras")) ||
        (filtroEmpresa === "PREMIER" && u.empresa.includes("Premier"));

      const matchStatus =
        filtroStatus === "TODOS" || u.status === filtroStatus;

      return matchBusca && matchEmpresa && matchStatus;
    });
  }, [usuariosPermitidos, busca, filtroEmpresa, filtroStatus]);

  // Métricas rápidas
  const totalUsuarios = usuariosPermitidos.length;
  const totalPetrobras = usuariosPermitidos.filter((u) => u.empresa.includes("Petrobras")).length;
  const totalPremier = usuariosPermitidos.filter((u) => u.empresa.includes("Premier")).length;
  const totalAtivos = usuariosPermitidos.filter((u) => u.status === "ATIVO").length;

  const handleResetarDados = () => {
    if (!ehPremierAdmin) {
      alert("Apenas o perfil PREMIER_ADMIN possui autorização para restaurar a base.");
      return;
    }
    if (confirm("Deseja restaurar os usuários e dados para a configuração padrão da demonstração?")) {
      resetarDadosParaPadrao();
      atualizarUsuarios(USUARIOS_INICIAIS);
      setMensagem("Base de usuários restaurada para o padrão inicial.");
      setTimeout(() => setMensagem(""), 4000);
    }
  };

  const handleRemoverUsuario = (id: string, nome: string) => {
    if (!ehPremierAdmin) {
      alert("Apenas o perfil PREMIER_ADMIN pode remover perfis.");
      return;
    }
    if (id === "usr-06") {
      alert("O Administrador Master não pode ser removido.");
      return;
    }
    if (confirm(`Remover o perfil de "${nome}" e revogar o acesso ao sistema?`)) {
      const novaLista = usuarios.filter((u) => u.id !== id);
      atualizarUsuarios(novaLista);
      setMensagem(`Perfil de "${nome}" removido com sucesso.`);
      setTimeout(() => setMensagem(""), 4000);
    }
  };

  const handleAlterarStatus = (id: string, novoStatus: UsuarioGovernance["status"]) => {
    if (!ehPremierAdmin) {
      alert("Apenas o perfil PREMIER_ADMIN pode alterar o status de usuários.");
      return;
    }
    if (id === "usr-06" && novoStatus !== "ATIVO") {
      alert("O Administrador Master deve permanecer com status ATIVO.");
      return;
    }
    const usuarioAlvo = usuarios.find((u) => u.id === id);
    const novaLista = usuarios.map((u) => (u.id === id ? { ...u, status: novoStatus } : u));
    atualizarUsuarios(novaLista);
    setMensagem(`Status de "${usuarioAlvo?.nome || "usuário"}" atualizado para ${novoStatus}.`);
    setTimeout(() => setMensagem(""), 4000);
  };

  const handleSubmitNovoUsuario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ehPremierAdmin) return;
    if (!formNome || !formEmail) return;

    const novoUsr: UsuarioGovernance = {
      id: `usr-${Date.now()}`,
      nome: formNome.trim(),
      email: formEmail.trim().toLowerCase(),
      empresa: formEmpresa,
      perfil: formPerfil,
      unidade: formUnidade,
      status: "ATIVO",
      totp: true,
      autorizadoPor: "Administrador Premier",
    };

    const novaLista = [...usuarios, novoUsr];
    atualizarUsuarios(novaLista);
    setMensagem(`Acesso concedido com sucesso para ${formEmail}!`);
    setModalConcessaoAberto(false);
    setFormNome("");
    setFormEmail("");
    setTimeout(() => setMensagem(""), 4000);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Topo Executivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-premier-900 text-white flex items-center justify-center shadow-sm">
              <Settings className="w-4 h-4 text-emerald-400" />
            </div>
            Gestão de Acessos & Usuários
          </h1>
          <p className="text-xs md:text-sm text-slate-500 mt-1">
            Controle de credenciais, concessão de perfis e governança de acesso ao contrato.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {ehPremierAdmin && (
            <button
              onClick={handleResetarDados}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold px-3 py-2 rounded-lg border border-slate-200 shadow-sm transition-all"
              title="Restaurar base de demonstração"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
              <span>Restaurar Padrão</span>
            </button>
          )}

          {ehPremierAdmin ? (
            <button
              onClick={() => setModalConcessaoAberto(true)}
              className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-sm hover:shadow transition-all"
            >
              <UserPlus className="w-4 h-4 text-emerald-400" />
              <span>Novo Usuário</span>
            </button>
          ) : (
            <div className="text-xs text-slate-400 font-medium px-3 py-1.5 bg-slate-100 rounded-lg">
              Visualização Restrita
            </div>
          )}
        </div>
      </div>

      {/* Feedback Alert */}
      {mensagem && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-lg text-xs flex items-center justify-between shadow-sm animate-fadeIn">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{mensagem}</span>
          </div>
          <button onClick={() => setMensagem("")} className="text-emerald-700 hover:text-emerald-900">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cards de Métricas Executivas (Clean & Modern) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Total de Contas
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalUsuarios}</span>
              <span className="text-xs text-emerald-600 font-medium">{totalAtivos} ativas</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Petrobras (Contratante)
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalPetrobras}</span>
              <span className="text-xs text-slate-500">Fiscais / Gestores</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Building2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
              Premier Logistics
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalPremier}</span>
              <span className="text-xs text-slate-500">Operações / Gestão</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600">
            <Briefcase className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Campo de Busca */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome ou e-mail..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-premier-700 transition-all"
          />
        </div>

        {/* Filtros em Tabs */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {/* Organização */}
          <div className="inline-flex bg-slate-100 p-0.5 rounded-lg text-xs font-medium text-slate-600">
            <button
              onClick={() => setFiltroEmpresa("TODAS")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filtroEmpresa === "TODAS" ? "bg-white text-slate-900 shadow-sm font-semibold" : "hover:text-slate-900"
              }`}
            >
              Todas
            </button>
            <button
              onClick={() => setFiltroEmpresa("PETROBRAS")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filtroEmpresa === "PETROBRAS" ? "bg-white text-emerald-800 shadow-sm font-semibold" : "hover:text-slate-900"
              }`}
            >
              Petrobras
            </button>
            <button
              onClick={() => setFiltroEmpresa("PREMIER")}
              className={`px-2.5 py-1 rounded-md transition-all ${
                filtroEmpresa === "PREMIER" ? "bg-white text-blue-800 shadow-sm font-semibold" : "hover:text-slate-900"
              }`}
            >
              Premier
            </button>
          </div>

          {/* Filtro Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value as "TODOS" | "ATIVO" | "BLOQUEADO")}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 font-medium outline-none focus:border-premier-700 cursor-pointer"
          >
            <option value="TODOS">Todos os Status</option>
            <option value="ATIVO">Somente Ativos</option>
            <option value="BLOQUEADO">Somente Bloqueados</option>
          </select>
        </div>
      </div>

      {/* Tabela Moderna */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Usuário</th>
                <th className="py-3 px-4">Perfil Contratual</th>
                <th className="py-3 px-4">Organização</th>
                <th className="py-3 px-4">Unidade</th>
                <th className="py-3 px-4 text-center">Status</th>
                {ehPremierAdmin && (
                  <th className="py-3 px-4 text-center w-20">Ação</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {usuariosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Nenhum usuário encontrado com os filtros selecionados.
                  </td>
                </tr>
              ) : (
                usuariosFiltrados.map((usr) => {
                  const perfilInfo = PERFIS_NOMES[usr.perfil] || {
                    titulo: usr.perfil,
                    area: "Operacional",
                  };
                  const isPetrobras = usr.empresa.includes("Petrobras");

                  return (
                    <tr key={usr.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Usuário com Avatar */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                              isPetrobras
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {obterIniciais(usr.nome)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 leading-snug">
                              {usr.nome}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {usr.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Perfil Contratual Legível */}
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-800">
                          {perfilInfo.titulo}
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {usr.perfil}
                        </div>
                      </td>

                      {/* Organização */}
                      <td className="py-3 px-4">
                        <span className="font-medium text-slate-700">
                          {isPetrobras ? "Petrobras" : "Premier Logistics"}
                        </span>
                      </td>

                      {/* Unidade */}
                      <td className="py-3 px-4 text-slate-600 font-normal">
                        {usr.unidade}
                      </td>

                      {/* Status com Indicador Visual Moderno */}
                      <td className="py-3 px-4 text-center">
                        {ehPremierAdmin && usr.id !== "usr-06" ? (
                          <div className="inline-flex items-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                usr.status === "ATIVO"
                                  ? "bg-emerald-500"
                                  : usr.status === "BLOQUEADO"
                                  ? "bg-rose-500"
                                  : "bg-slate-400"
                              }`}
                            />
                            <select
                              value={usr.status}
                              onChange={(e) =>
                                handleAlterarStatus(
                                  usr.id,
                                  e.target.value as UsuarioGovernance["status"]
                                )
                              }
                              className="bg-transparent text-slate-700 text-xs font-medium cursor-pointer outline-none hover:text-slate-900 transition-colors"
                              title="Clique para modificar status"
                            >
                              <option value="ATIVO">ATIVO</option>
                              <option value="INATIVO">INATIVO</option>
                              <option value="BLOQUEADO">BLOQUEADO</option>
                              <option value="PENDENTE">PENDENTE</option>
                            </select>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 justify-center">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                usr.status === "ATIVO" ? "bg-emerald-500" : "bg-slate-400"
                              }`}
                            />
                            <span className="text-slate-700 font-medium text-xs">
                              {usr.status}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Ação */}
                      {ehPremierAdmin && (
                        <td className="py-3 px-4 text-center">
                          {usr.id === "usr-06" ? (
                            <span
                              className="text-[10px] text-slate-400 font-medium px-2 py-0.5"
                              title="Perfil Administrador Principal do Sistema"
                            >
                              Fixo
                            </span>
                          ) : (
                            <button
                              onClick={() => handleRemoverUsuario(usr.id, usr.nome)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title={`Remover perfil de ${usr.nome}`}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Rodapé da tabela com total */}
        <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Mostrando <strong>{usuariosFiltrados.length}</strong> de{" "}
            <strong>{usuariosPermitidos.length}</strong> usuários
          </span>
          <span className="text-[11px] text-slate-400 font-mono">
            Contrato ICJ 5900.0129796.25.2
          </span>
        </div>
      </div>

      {/* Modal de Concessão de Acesso */}
      {modalConcessaoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-scaleIn">
            <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <h3 className="font-semibold text-sm">Conceder Novo Acesso</h3>
              </div>
              <button
                onClick={() => setModalConcessaoAberto(false)}
                className="text-slate-300 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitNovoUsuario} className="p-5 space-y-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  Nome Completo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Roberto Gomes"
                  value={formNome}
                  onChange={(e) => setFormNome(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-premier-700 transition-colors"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">
                  E-mail Corporativo <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="usuario@empresa.com.br"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-slate-800 outline-none focus:border-premier-700 font-mono transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Organização</label>
                  <select
                    value={formEmpresa}
                    onChange={(e) =>
                      setFormEmpresa(
                        e.target.value as
                          | "Petróleo Brasileiro S.A. – Petrobras"
                          | "Premier Logistics"
                      )
                    }
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-800 outline-none focus:border-premier-700 transition-colors"
                  >
                    <option value="Premier Logistics">Premier Logistics</option>
                    <option value="Petróleo Brasileiro S.A. – Petrobras">Petrobras</option>
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Perfil Contratual</label>
                  <select
                    value={formPerfil}
                    onChange={(e) => setFormPerfil(e.target.value)}
                    className="w-full border border-slate-200 rounded-lg px-2.5 py-2 bg-white text-slate-800 outline-none focus:border-premier-700 transition-colors"
                  >
                    <option value="PETROBRAS_FISCAL">Fiscal Técnico (Petrobras)</option>
                    <option value="PETROBRAS_GESTOR">Gestor Contrato (Petrobras)</option>
                    <option value="PREMIER_SUPERVISOR">Supervisor Campo (Premier)</option>
                    <option value="PREMIER_RH">Recursos Humanos (Premier)</option>
                    <option value="PREMIER_GESTOR_CONTRATO">Gestor Operacional (Premier)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700 block mb-1">Unidade de Lotação</label>
                <select
                  value={formUnidade}
                  onChange={(e) => setFormUnidade(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 outline-none focus:border-premier-700 transition-colors"
                >
                  <option value="UFN III – Três Lagoas/MS">UFN III – Três Lagoas/MS</option>
                  <option value="RPBC – Cubatão/SP">RPBC – Cubatão/SP</option>
                  <option value="REPLAN – Paulínia/SP">REPLAN – Paulínia/SP</option>
                  <option value="Todas as Unidades">Todas as Unidades Contratuais</option>
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModalConcessaoAberto(false)}
                  className="px-3.5 py-2 text-slate-600 hover:text-slate-900 font-medium rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-premier-900 hover:bg-premier-800 text-white font-semibold rounded-lg shadow transition-colors"
                >
                  Confirmar Acesso
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
