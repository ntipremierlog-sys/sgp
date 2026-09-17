"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";

export default function AcessoNegadoPage() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[#E3E6EB] shadow-lg p-6 sm:p-8 text-center space-y-6">
        {/* Ícone de Alerta de Segurança */}
        <div className="w-16 h-16 rounded-2xl bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] flex items-center justify-center mx-auto shadow-xs">
          <ShieldAlert className="w-8 h-8" />
        </div>

        {/* Título e Explicação */}
        <div className="space-y-2">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#F2F4F7] text-[#344054]">
            Código 403 · Restrição de Acesso
          </span>
          <h1 className="text-xl sm:text-2xl font-bold text-[#1A2230] tracking-tight">
            Acesso não permitido
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6474] leading-relaxed">
            Seu perfil de usuário autenticado não possui autorização contratual para acessar este recurso ou área restrita do sistema.
          </p>
        </div>

        {/* Caixa de Esclarecimento de Governança */}
        <div className="p-3.5 bg-[#F9FAFB] rounded-xl border border-[#EAECF0] text-left text-xs text-[#475467] space-y-1">
          <div className="font-semibold text-[#1D2939] flex items-center gap-1.5">
            <span>Diretriz de Segurança do Contrato</span>
          </div>
          <p className="text-[11px] text-[#667085] leading-normal">
            As permissões são controladas estritamente no servidor com base no cadastro corporativo. Caso necessite de alteração de permissão, contate o Administrador Premier.
          </p>
        </div>

        {/* Botão de Ação */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link
            href="/"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#1F4FD1] hover:bg-[#163CA8] text-white text-xs font-semibold shadow-sm transition-all"
          >
            <Home className="w-4 h-4" />
            <span>Ir para o Painel Geral</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
