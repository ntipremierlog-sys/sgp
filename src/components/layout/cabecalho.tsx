"use client";

import React, { useState, useEffect } from "react";
import { FileText, Shield } from "lucide-react";
import { carregarEstado, alternarPerfil } from "@/lib/dados/estado-operacional";
import { SegmentedControl } from "@/components/painel/segmented-control";

interface CabecalhoProps {
  perfilAtivo?: string;
  nomeUsuario?: string;
}

export function Cabecalho({
  perfilAtivo: propPerfil,
  nomeUsuario: propNome,
}: CabecalhoProps) {
  const [perfil, setPerfil] = useState(propPerfil || "PREMIER_GESTOR");
  const [nome, setNome] = useState(propNome || "Gestor de Operações");

  useEffect(() => {
    const sincronizar = () => {
      const estado = carregarEstado();
      const p = estado.perfilAtivo || "PREMIER_GESTOR";
      setPerfil(p);
      if (p.startsWith("PETROBRAS")) {
        setNome("Carlos Eduardo Mendes");
      } else {
        setNome("Gestor de Operações Premier");
      }
    };

    sincronizar();
    window.addEventListener("sgp-dados-atualizados", sincronizar);
    return () => window.removeEventListener("sgp-dados-atualizados", sincronizar);
  }, []);

  const handleMudarPerfil = (novoPerfil: string) => {
    setPerfil(novoPerfil);
    alternarPerfil(novoPerfil);
  };

  const isFiscal = perfil === "PETROBRAS_FISCAL";
  const iniciais = isFiscal ? "CM" : "GP";

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

        {/* Direita: Controle segmentado (Gestor | Fiscal) + Divisor + Avatar */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-block text-xs font-medium text-[#5B6474]">
              Visualizar como:
            </span>
            <SegmentedControl
              size="sm"
              value={perfil === "PETROBRAS_FISCAL" ? "PETROBRAS_FISCAL" : "PREMIER_GESTOR"}
              onChange={handleMudarPerfil}
              options={[
                { value: "PREMIER_GESTOR", label: "Gestor Premier" },
                { value: "PETROBRAS_FISCAL", label: "Fiscal Petrobras" },
              ]}
              ariaLabel="Alternar perfil de visualização"
            />
          </div>

          <div className="h-6 w-px bg-[#E3E6EB] hidden sm:block" />

          {/* Avatar com iniciais, nome e perfil */}
          <div className="flex items-center gap-2.5">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs shadow-xs ${
                isFiscal
                  ? "bg-[#E7F6EE] text-[#0F7B4F] border border-[#A7F3D0]"
                  : "bg-[#E8EEFD] text-[#1F4FD1] border border-[#BFDBFE]"
              }`}
            >
              {iniciais}
            </div>

            <div className="text-left hidden lg:block leading-tight">
              <span className="font-semibold text-xs text-[#1A2230] block">
                {nome}
              </span>
              <span className="text-[11px] text-[#5B6474] flex items-center gap-1">
                <Shield className="w-2.5 h-2.5 text-[#0F7B4F]" />
                <span>{isFiscal ? "Fiscal Petrobras (LGPD)" : "Gestor Premier"}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
