"use client";

import React from "react";
import Link from "next/link";
import { Users, UserCheck, Shield, AlertTriangle, ArrowRight, UserX } from "lucide-react";

interface DistribuicaoTrabalhoCardProps {
  presentes: number;
  substitutos: number;
  descobertos: number;
  vagos: number;
  totalPostos: number;
  competencia: string;
}

export function DistribuicaoTrabalhoCard({
  presentes,
  substitutos,
  descobertos,
  vagos,
  totalPostos,
  competencia,
}: DistribuicaoTrabalhoCardProps) {
  const totalAtivo = presentes + substitutos + descobertos;
  const pctPresentes = totalAtivo > 0 ? (presentes / totalAtivo) * 100 : 0;
  const pctSubstitutos = totalAtivo > 0 ? (substitutos / totalAtivo) * 100 : 0;
  const pctDescobertos = totalAtivo > 0 ? (descobertos / totalAtivo) * 100 : 0;

  return (
    <div className="bg-white rounded-xl border border-[#E3E6EB] p-5 shadow-xs flex flex-col justify-between space-y-4">
      <div className="flex items-center justify-between border-b border-[#F1F3F5] pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1F4FD1]" />
            <h3 className="text-sm font-bold text-[#1A2230] uppercase tracking-wider">
              Distribuição da Força de Trabalho
            </h3>
          </div>
          <p className="text-xs text-[#5B6474] mt-0.5">
            Composição da escala ativa e coberturas operacionais no turno de hoje
          </p>
        </div>
        <Link
          href={`/presenca-diaria?competencia=${competencia}`}
          className="text-xs font-semibold text-[#1F4FD1] hover:underline flex items-center gap-1 shrink-0"
        >
          <span>Ver escala diária</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Barra Segmentada de Distribuição */}
      <div className="space-y-2">
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
          {pctPresentes > 0 && (
            <div
              style={{ width: `${pctPresentes}%` }}
              className="bg-emerald-500 hover:bg-emerald-600 transition-colors"
              title={`Titulares Presentes: ${presentes} (${pctPresentes.toFixed(1)}%)`}
            />
          )}
          {pctSubstitutos > 0 && (
            <div
              style={{ width: `${pctSubstitutos}%` }}
              className="bg-blue-500 hover:bg-blue-600 transition-colors"
              title={`Coberturas / Substitutos: ${substitutos} (${pctSubstitutos.toFixed(1)}%)`}
            />
          )}
          {pctDescobertos > 0 && (
            <div
              style={{ width: `${pctDescobertos}%` }}
              className="bg-rose-500 hover:bg-rose-600 transition-colors"
              title={`Descobertos no Turno: ${descobertos} (${pctDescobertos.toFixed(1)}%)`}
            />
          )}
        </div>

        {/* Legenda e Métricas Detalhadas */}
        <div className="grid grid-cols-3 gap-2.5 pt-1">
          {/* 1. Titulares Presentes */}
          <div className="p-3 rounded-lg border border-[#E3E6EB] bg-white">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2230]">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
              <span>Titulares</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#1A2230]">{presentes}</span>
              <span className="text-xs font-semibold text-emerald-700">
                {pctPresentes.toFixed(0)}%
              </span>
            </div>
            <span className="text-[11px] text-[#5B6474] block mt-0.5">Em operação regular</span>
          </div>

          {/* 2. Coberturas / Substitutos */}
          <div className="p-3 rounded-lg border border-[#E3E6EB] bg-white">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2230]">
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span>Substitutos</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-[#1A2230]">{substitutos}</span>
              <span className="text-xs font-semibold text-blue-700">
                {pctSubstitutos.toFixed(0)}%
              </span>
            </div>
            <span className="text-[11px] text-[#5B6474] block mt-0.5">Garantindo cobertura</span>
          </div>

          {/* 3. Descobertos */}
          <div className="p-3 rounded-lg border border-[#E3E6EB] bg-white">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1A2230]">
              <span className={`w-2 h-2 rounded-full shrink-0 ${descobertos > 0 ? "bg-rose-500" : "bg-slate-300"}`} />
              <span className={descobertos > 0 ? "text-[#D92D20]" : "text-[#1A2230]"}>Descobertos</span>
            </div>
            <div className="mt-1.5 flex items-baseline justify-between">
              <span className={`text-2xl font-bold ${descobertos > 0 ? "text-[#D92D20]" : "text-[#1A2230]"}`}>
                {descobertos}
              </span>
              <span className={`text-xs font-semibold ${descobertos > 0 ? "text-[#D92D20]" : "text-[#5B6474]"}`}>
                {pctDescobertos.toFixed(0)}%
              </span>
            </div>
            <span className="text-[11px] text-[#5B6474] block mt-0.5">
              {descobertos > 0 ? "Sem cobertura ativa" : "Nenhum no turno"}
            </span>
          </div>
        </div>
      </div>

      {/* Rodapé com Destaque de Postos Vagos Homologados */}
      <div className="pt-2 border-t border-[#F1F3F5] flex items-center justify-between text-xs text-[#5B6474]">
        <span>Quadro Total: <strong className="text-[#1A2230]">{totalPostos} postos homologados</strong></span>
        {vagos > 0 ? (
          <Link
            href={`/postos?aba=VAGOS&competencia=${competencia}`}
            className="text-rose-700 font-bold hover:underline flex items-center gap-1"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            <span>{vagos} postos vagos (Anexo 1-A)</span>
          </Link>
        ) : (
          <span className="text-emerald-700 font-semibold">100% dos postos alocados</span>
        )}
      </div>
    </div>
  );
}
