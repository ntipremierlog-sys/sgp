import React from "react";
import { ShieldCheck, Database } from "lucide-react";

export function RodapeLgpd() {
  return (
    <footer className="w-full bg-slate-900 border-t border-slate-800 text-slate-300 text-xs py-2 px-4 select-none shrink-0">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-center md:text-left">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>
            <strong>Aviso de Finalidade (LGPD):</strong> Informações disponibilizadas exclusivamente para as finalidades de execução, fiscalização e medição do Contrato ICJ 5900.0129796.25.2, nos termos da Lei nº 13.709/2018.
          </span>
        </div>
        <div className="flex items-center gap-3 text-slate-400 text-[11px] shrink-0">
          <span className="flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            PostgreSQL Neon (aws-sa-east-1 • São Paulo)
          </span>
          <span>•</span>
          <span>Vercel (gru1)</span>
        </div>
      </div>
    </footer>
  );
}
