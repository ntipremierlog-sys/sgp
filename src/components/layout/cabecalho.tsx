"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { FileText, Shield, LogOut } from "lucide-react";
import { NOMES_PERFIS } from "@/lib/auth/permissoes";
import { PerfilUsuario, UsuarioSessao } from "@/lib/auth/tipos";

interface CabecalhoProps {
  perfilAtivo?: string;
  nomeUsuario?: string;
}

export function Cabecalho({
  perfilAtivo: propPerfil,
  nomeUsuario: propNome,
}: CabecalhoProps) {
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);

  useEffect(() => {
    const carregarSessao = async () => {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            setSessao(data.usuario);
            return;
          }
        }
      } catch {
        // fallback
      }
    };

    carregarSessao();
    window.addEventListener("sgp-sessao-alterada", carregarSessao);
    return () => window.removeEventListener("sgp-sessao-alterada", carregarSessao);
  }, []);

  const perfil = (sessao?.perfil || propPerfil || "PREMIER_ADMIN") as PerfilUsuario;
  const nome = sessao?.nome || propNome || "Administrador Premier";
  const nomePerfilLegivel = NOMES_PERFIS[perfil] || perfil;

  const isFiscal = perfil.startsWith("PETROBRAS");
  const isAdmin = perfil === "PREMIER_ADMIN";

  // Obter iniciais
  const partesNome = nome.trim().split(/\s+/);
  const iniciais =
    partesNome.length === 1
      ? partesNome[0].slice(0, 2).toUpperCase()
      : (partesNome[0][0] + partesNome[partesNome.length - 1][0]).toUpperCase();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full h-16 bg-white border-b border-[#E3E6EB] shadow-xs select-none">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Esquerda: Ícone de documento + Contrato Petrobras + Número em fonte mono */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#F1F3F5] flex items-center justify-center text-[#5B6474]">
            <FileText className="w-4 h-4 text-[#1F4FD1]" />
          </div>
          <div>
            <span className="text-xs text-[#5B6474] font-medium block leading-none">
              Contrato Petrobras
            </span>
            <span className="font-mono font-bold text-xs sm:text-sm text-[#1A2230] tracking-tight mt-0.5 block">
              5900.0129796.25.2
            </span>
          </div>
        </div>

        {/* Direita: Nome do Usuário + Nome do Perfil em texto simples (sem seletor de troca) */}
        <div className="flex items-center gap-3 sm:gap-4">
          {/* Avatar com iniciais, nome e perfil em texto simples */}
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                isAdmin
                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                  : isFiscal
                  ? "bg-[#E7F6EE] text-[#0F7B4F] border border-[#A7F3D0]"
                  : "bg-[#E8EEFD] text-[#1F4FD1] border border-[#BFDBFE]"
              }`}
            >
              {iniciais}
            </div>

            <div className="text-left hidden sm:block leading-tight">
              <span className="font-semibold text-xs text-[#1A2230] block">
                {nome}
              </span>
              <span className="text-[11px] text-[#5B6474] flex items-center gap-1 font-medium">
                <Shield
                  className={`w-2.5 h-2.5 ${
                    isAdmin
                      ? "text-purple-600"
                      : isFiscal
                      ? "text-[#0F7B4F]"
                      : "text-[#1F4FD1]"
                  }`}
                />
                <span>{nomePerfilLegivel}</span>
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-[#E3E6EB] hidden sm:block" />

          {/* Botão sutil de alternar conta de homologação / sair */}
          <div className="flex items-center gap-1">
            <Link
              href="/login"
              className="text-[11px] font-medium text-[#5B6474] hover:text-[#1F4FD1] px-2 py-1 rounded hover:bg-[#F2F4F7] transition-colors"
              title="Trocar de conta no ambiente de homologação"
            >
              Trocar usuário
            </Link>
            <button
              onClick={handleLogout}
              className="text-[#5B6474] hover:text-[#B42318] p-1.5 rounded-lg hover:bg-[#FEF3F2] transition-colors"
              title="Encerrar sessão"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
