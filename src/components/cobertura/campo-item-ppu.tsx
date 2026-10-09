"use client";

/**
 * Campo obrigatório "Item da PPU" usado ao designar uma cobertura.
 * O item é a base de cálculo da medição pela Petrobras. Vem pré-preenchido com o
 * item do posto coberto; pode ser alterado quando a cobertura for medida em outro item.
 */

import React from "react";
import { CATALOGO_ITEM_PPU } from "@/lib/dados/painel-calculo";

interface CampoItemPpuProps {
  id?: string;
  valor: string;
  onChange: (codigo: string) => void;
  /** Item do posto coberto (sugestão padrão) */
  itemDoPosto?: string;
  className?: string;
  disabled?: boolean;
}

export function CampoItemPpu({
  id = "campo-item-ppu",
  valor,
  onChange,
  itemDoPosto,
  className = "",
  disabled,
}: CampoItemPpuProps) {
  const divergeDoPosto = Boolean(itemDoPosto && valor && valor !== itemDoPosto);

  return (
    <div className={className}>
      <label htmlFor={id} className="font-medium text-slate-700 block mb-1 text-xs">
        Item da PPU <span className="text-rose-500">*</span>
      </label>
      <select
        id={id}
        required
        disabled={disabled}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 text-xs outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-500 transition-all disabled:bg-slate-50"
      >
        <option value="">Selecione o item da PPU…</option>
        {CATALOGO_ITEM_PPU.map((it) => (
          <option key={it.codigo} value={it.codigo}>
            {it.codigo} — {it.descricao}
            {it.codigo === itemDoPosto ? " (item do posto)" : ""}
          </option>
        ))}
      </select>
      <p className={`mt-1 text-[11px] ${divergeDoPosto ? "text-amber-700" : "text-slate-500"}`}>
        {divergeDoPosto
          ? `Atenção: diferente do item do posto (${itemDoPosto}). A medição usará o item ${valor}.`
          : "Base de cálculo da medição pela Petrobras."}
      </p>
    </div>
  );
}
