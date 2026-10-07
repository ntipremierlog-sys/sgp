"use client";

import React from "react";
import Link from "next/link";
import { Construction, ArrowLeft, LayoutDashboard, CalendarCheck } from "lucide-react";

interface ModuloEmConstrucaoProps {
  titulo?: string;
  subtitulo?: string;
}

export function ModuloEmConstrucao({
  titulo = "Módulo em Construção",
  subtitulo = "Este módulo está em desenvolvimento e suas funcionalidades serão disponibilizadas em breve.",
}: ModuloEmConstrucaoProps) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 text-center space-y-6">
        {/* Ícone de Construção em Destaque */}
        <div className="mx-auto w-20 h-20 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center shadow-xs">
          <Construction className="w-10 h-10 animate-pulse" />
        </div>

        {/* Título e Mensagem */}
        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100/70 text-amber-900 border border-amber-300">
            <span>Em Desenvolvimento</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {titulo}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
            {subtitulo}
          </p>
        </div>

        {/* Linha Divisória Sutil */}
        <div className="border-t border-slate-100 pt-2" />

        {/* Ações de Retorno */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
          <Link
            href="/mapa-ocupacao"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1F4FD1] hover:bg-[#1A42B3] text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <CalendarCheck className="w-4 h-4" />
            <span>Mapa de Cobertura</span>
          </Link>
          <Link
            href="/painel"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Painel Geral</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
