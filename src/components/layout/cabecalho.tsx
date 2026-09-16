"use client";

import React, { useState, useEffect } from "react";
import { Building2, ChevronDown, UserCheck, Shield, FileText } from "lucide-react";
import { carregarEstado, salvarEstado } from "@/lib/dados/estado-operacional";

interface CabecalhoProps {
  unidadeSelecionada?: string;
  onSelecionarUnidade?: (unidade: string) => void;
  perfilAtivo?: string;
  nomeUsuario?: string;
}

export function Cabecalho({
  unidadeSelecionada: propUnidade,
  onSelecionarUnidade,
  perfilAtivo: propPerfil,
  nomeUsuario: propNome,
}: CabecalhoProps) {
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [unidade, setUnidade] = useState(propUnidade || "UFN III – Três Lagoas/MS");
  const [perfil, setPerfil] = useState(propPerfil || "PREMIER_ADMIN");
  const [nome, setNome] = useState(propNome || "Administrador Premier");

  useEffect(() => {
    const sincronizar = () => {
      const estado = carregarEstado();
      setPerfil(estado.perfilAtivo);
      if (estado.unidadeSelecionada) {
        setUnidade(estado.unidadeSelecionada);
      }
      if (estado.perfilAtivo.startsWith("PETROBRAS")) {
        setNome("Carlos Eduardo Mendes");
      } else {
        setNome("Administrador Premier");
      }
    };

    sincronizar();
    window.addEventListener("sgp-dados-atualizados", sincronizar);
    return () => window.removeEventListener("sgp-dados-atualizados", sincronizar);
  }, []);

  const unidades = [
    "Todas as Unidades",
    "UFN III – Três Lagoas/MS",
    "RPBC – Cubatão/SP",
    "REPLAN – Paulínia/SP",
    "REDUC – Duque de Caxias/RJ",
  ];

  const handleSelect = (uni: string) => {
    setUnidade(uni);
    salvarEstado({ unidadeSelecionada: uni });
    if (onSelecionarUnidade) {
      onSelecionarUnidade(uni);
    }
    setDropdownAberto(false);
  };

  const getPerfilBadgeClass = (p: string) => {
    if (p.startsWith("PETROBRAS")) {
      return "bg-emerald-900/80 text-emerald-200 border-emerald-600";
    }
    if (p.startsWith("PREMIER_ADMIN")) {
      return "bg-amber-900/80 text-amber-200 border-amber-600";
    }
    return "bg-blue-900/80 text-blue-200 border-blue-600";
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0F2042] text-white border-b border-slate-700 shadow-md">
      <div className="px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Identificação Premier & Contrato */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-500 to-premier-800 flex items-center justify-center font-bold text-white shadow">
              P
            </div>
            <div>
              <div className="flex items-center gap-1.5 leading-tight">
                <span className="font-semibold text-sm tracking-wide">PREMIER LOGISTICS</span>
                <span className="text-[10px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded border border-blue-800">SGP</span>
              </div>
              <p className="text-[11px] text-slate-300 flex items-center gap-1">
                <FileText className="w-3 h-3 text-amber-400" />
                <span>Contrato Petrobras ICJ: <strong>5900.0129796.25.2</strong></span>
              </p>
            </div>
          </div>

          <div className="hidden lg:block h-6 w-px bg-slate-700 mx-1" />

          {/* Seletor de Unidade */}
          <div className="relative">
            <button
              onClick={() => setDropdownAberto(!dropdownAberto)}
              className="flex items-center gap-2 bg-slate-800/90 hover:bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 transition-colors"
              title="Selecione a Unidade de Execução"
            >
              <Building2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-medium max-w-[200px] truncate">{unidade}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {dropdownAberto && (
              <div className="absolute left-0 mt-1 w-64 bg-slate-900 border border-slate-700 rounded shadow-xl py-1 z-50 text-xs">
                <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  Unidades de Execução
                </div>
                {unidades.map((u) => (
                  <button
                    key={u}
                    onClick={() => handleSelect(u)}
                    className={`w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors flex items-center justify-between ${
                      u === unidade ? "text-blue-400 font-semibold bg-slate-800/50" : "text-slate-300"
                    }`}
                  >
                    <span>{u}</span>
                    {u === unidade && <span className="text-[10px] text-blue-400">●</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Usuário e Perfil Ativo */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium text-slate-100 flex items-center justify-end gap-1">
              <UserCheck className="w-3.5 h-3.5 text-slate-400" />
              <span>{nome}</span>
            </div>
            <div className="text-[10px] text-slate-400">
              {perfil.startsWith("PETROBRAS") ? "petrobras.com.br" : "premierlogistics.com.br"}
            </div>
          </div>

          <div
            className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${getPerfilBadgeClass(
              perfil,
            )}`}
            title={`Perfil de Acesso ativo com permissões RBAC no servidor`}
          >
            <Shield className="w-3 h-3" />
            <span>{perfil}</span>
          </div>
        </div>
      </div>
    </header>
  );
}
