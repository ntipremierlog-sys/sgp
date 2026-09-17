"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  KeyRound,
  Users,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { NOMES_PERFIS } from "@/lib/auth/permissoes";

interface UsuarioTesteInfo {
  id: string;
  nome: string;
  email: string;
  perfil: keyof typeof NOMES_PERFIS;
  empresa: string;
  unidade: string;
  descricao: string;
}

const CONTAS_HOMOLOGACAO: UsuarioTesteInfo[] = [
  {
    id: "usr-admin-01",
    nome: "Administrador Premier",
    email: "admin.sgp@premierlogistics.com.br",
    perfil: "PREMIER_ADMIN",
    empresa: "Premier Logistics",
    unidade: "Todas as Bases",
    descricao: "Acesso total irrestrito + Gestão de Usuários, Parâmetros e Administração",
  },
  {
    id: "usr-gestor-01",
    nome: "Marcos Valério de Souza",
    email: "marcos.valerio@premierlogistics.com.br",
    perfil: "PREMIER_GESTOR",
    empresa: "Premier Logistics",
    unidade: "Todas as Bases",
    descricao: "Gestão operacional integral (painéis, mapa, relatórios). Sem Administração",
  },
  {
    id: "usr-fiscal-01",
    nome: "Carlos Eduardo Mendes",
    email: "carlos.mendes@petrobras.com.br",
    perfil: "PETROBRAS_FISCAL",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    unidade: "UFN-III (Três Lagoas)",
    descricao: "Fiscalização somente leitura (LGPD segregado, sem CID-10, sem glosa interna)",
  },
  {
    id: "usr-gestor-petro-01",
    nome: "Mariana Albuquerque",
    email: "mariana.albuquerque@petrobras.com.br",
    perfil: "PETROBRAS_GESTOR",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    unidade: "Todas as Bases",
    descricao: "Acompanhamento contratual Petrobras. Sem telas internas Premier",
  },
  {
    id: "usr-supervisor-01",
    nome: "Renato Silva",
    email: "renato.silva@premierlogistics.com.br",
    perfil: "PREMIER_SUPERVISOR",
    empresa: "Premier Logistics",
    unidade: "UFN-III (Três Lagoas)",
    descricao: "Supervisão operacional de campo e registros de cobertura",
  },
  {
    id: "usr-rh-01",
    nome: "Fabiana Ribeiro",
    email: "fabiana.ribeiro@premierlogistics.com.br",
    perfil: "PREMIER_RH",
    empresa: "Premier Logistics",
    unidade: "Todas as Bases",
    descricao: "Gestão de colaboradores, SESMT e atestados médicos homologados",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState("");
  const [emailManual, setEmailManual] = useState("");

  const handleEntrarComUsuario = async (usuarioId: string) => {
    setCarregando(true);
    setMensagem("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId }),
      });

      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        throw new Error(data.erro || "Falha na autenticação");
      }

      setMensagem("Sessão autenticada com sucesso! Redirecionando...");
      window.dispatchEvent(new CustomEvent("sgp-sessao-alterada"));
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setMensagem(`Erro: ${msg}`);
      setCarregando(false);
    }
  };

  const handleLoginManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailManual.trim()) return;

    setCarregando(true);
    setMensagem("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: emailManual.trim() }),
      });

      const data = await res.json();
      if (!res.ok || !data.sucesso) {
        throw new Error(data.erro || "Credenciais não reconhecidas");
      }

      setMensagem("Autenticado com sucesso! Redirecionando...");
      window.dispatchEvent(new CustomEvent("sgp-sessao-alterada"));
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setMensagem(`Erro: ${msg}`);
      setCarregando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      {/* Topo Institucional */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E8EEFD] border border-[#BFDBFE] text-xs font-semibold text-[#1F4FD1]">
          <Shield className="w-3.5 h-3.5" />
          <span>Autenticação Híbrida · Contrato Petrobras ICJ 5900.0129796.25.2</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#1A2230] tracking-tight">
          Acesso ao SGP — Sistema de Gestão de Postos
        </h1>
        <p className="text-xs sm:text-sm text-[#5B6474] max-w-xl mx-auto">
          O perfil de acesso é definido estritamente pela sua conta autenticada no servidor. Não é permitida a troca manual de perfis dentro da aplicação.
        </p>
      </div>

      {mensagem && (
        <div className="p-3.5 rounded-xl text-xs font-medium text-center bg-blue-50 border border-blue-200 text-blue-800">
          {mensagem}
        </div>
      )}

      {/* Grid Principal */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Lado Esquerdo: Login Tradicional (SSO ou Local) */}
        <div className="md:col-span-2 bg-white rounded-2xl border border-[#E3E6EB] p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#1A2230]">
            <KeyRound className="w-4 h-4 text-[#1F4FD1]" />
            <span>Login de Usuário</span>
          </div>

          <form onSubmit={handleLoginManual} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#344054] mb-1">
                E-mail corporativo:
              </label>
              <input
                type="email"
                placeholder="nome@premierlogistics.com.br"
                value={emailManual}
                onChange={(e) => setEmailManual(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-[#D0D5DD] focus:outline-none focus:ring-2 focus:ring-[#1F4FD1] bg-[#F9FAFB]"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
            >
              <span>Entrar com conta local</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-[#E4E7EC]" />
            <span className="flex-shrink mx-2 text-[10px] text-[#98A2B3] uppercase font-bold">
              ou
            </span>
            <div className="flex-grow border-t border-[#E4E7EC]" />
          </div>

          <button
            type="button"
            onClick={() => handleEntrarComUsuario("usr-gestor-01")}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-[#D0D5DD] hover:bg-[#F9FAFB] text-xs font-semibold text-[#344054] shadow-xs transition-all"
          >
            <div className="w-3.5 h-3.5 flex items-center justify-center">
              <span className="text-[#00A4EF] font-black text-xs">⊞</span>
            </div>
            <span>Entrar com Microsoft Entra ID</span>
          </button>
        </div>

        {/* Lado Direito: Seletor de Contas de Teste para Homologação */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-[#E3E6EB] p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-[#1A2230]">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>Ambiente de Homologação · Validação de Perfis</span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
              Dev / Teste
            </span>
          </div>
          <p className="text-xs text-[#5B6474]">
            Selecione uma conta de teste oficial abaixo para simular a navegação exata com as permissões restritas daquele perfil:
          </p>

          <div className="space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
            {CONTAS_HOMOLOGACAO.map((usr) => (
              <button
                key={usr.id}
                onClick={() => handleEntrarComUsuario(usr.id)}
                disabled={carregando}
                className="w-full text-left p-3 rounded-xl border border-[#EAECF0] hover:border-[#1F4FD1] hover:bg-[#F8F9FC] transition-all group flex items-start justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-xs text-[#1A2230] group-hover:text-[#1F4FD1]">
                      {usr.nome}
                    </span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.2 rounded-full ${
                        usr.perfil === "PREMIER_ADMIN"
                          ? "bg-purple-100 text-purple-800"
                          : usr.perfil.startsWith("PETROBRAS")
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-blue-100 text-blue-800"
                      }`}
                    >
                      {NOMES_PERFIS[usr.perfil]}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#5B6474] truncate">
                    {usr.email} • <span className="font-medium text-[#344054]">{usr.unidade}</span>
                  </div>
                  <p className="text-[11px] text-[#667085] leading-tight">
                    {usr.descricao}
                  </p>
                </div>

                <div className="shrink-0 pt-1 text-[#98A2B3] group-hover:text-[#1F4FD1]">
                  <ArrowRight className="w-4 h-4" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
