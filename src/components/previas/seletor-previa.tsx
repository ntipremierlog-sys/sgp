"use client";

/**
 * SGP — Seletor de Competência + Prévia (período de conferência).
 *
 * As datas das prévias vêm SEMPRE do servidor (GET /api/previas), que usa a
 * função única obterPrevia(data) e o cadastro previa_competencia. Esta tela não
 * calcula datas de prévia por conta própria.
 * Ao abrir, seleciona a prévia que contém a data de hoje.
 */

import { useEffect, useMemo, useState } from "react";
import type { Previa } from "@/lib/servicos/previas";
import { rotuloPreviaComDatas, formatarDdMm } from "@/lib/servicos/previas";

export interface SelecaoPrevia {
  competencia: string;
  numero: number;
  previa: Previa | null;
}

export function useSelecaoPrevia() {
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [competencia, setCompetencia] = useState("");
  const [numero, setNumero] = useState<number>(0);
  const [carregandoPrevias, setCarregandoPrevias] = useState(true);
  const [erroPrevias, setErroPrevias] = useState("");

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const res = await fetch("/api/previas", { cache: "no-store" });
        const dados = await res.json();
        if (!ativo) return;
        if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao carregar as prévias.");
        setPrevias(dados.previas || []);
        setCompetencia(dados.previaDaData.competencia);
        setNumero(dados.previaDaData.numero);
      } catch (e: any) {
        if (ativo) setErroPrevias(e?.message || "Falha ao carregar as prévias.");
      } finally {
        if (ativo) setCarregandoPrevias(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const competencias = useMemo(
    () => Array.from(new Set(previas.map((p) => p.competencia))).sort().reverse(),
    [previas]
  );
  const previasDaCompetencia = useMemo(
    () => previas.filter((p) => p.competencia === competencia).sort((a, b) => a.numero - b.numero),
    [previas, competencia]
  );
  const previa = previasDaCompetencia.find((p) => p.numero === numero) || null;

  const selecionarCompetencia = (c: string) => {
    setCompetencia(c);
    const lista = previas.filter((p) => p.competencia === c);
    if (!lista.some((p) => p.numero === numero)) setNumero(1);
  };

  return {
    previas,
    competencias,
    previasDaCompetencia,
    competencia,
    numero,
    previa,
    pronto: Boolean(previa),
    carregandoPrevias,
    erroPrevias,
    selecionarCompetencia,
    selecionarNumero: setNumero,
  };
}

function rotuloCompetenciaCurto(competencia: string, previas: Previa[]): string {
  const [a, m] = competencia.split("-");
  const lista = previas.filter((p) => p.competencia === competencia).sort((x, y) => x.numero - y.numero);
  if (lista.length === 0) return `${m}/${a}`;
  return `${m}/${a} (${formatarDdMm(lista[0].dataInicio)} a ${formatarDdMm(lista[lista.length - 1].dataFim)})`;
}

export function SeletorPrevia({
  selecao,
  className = "",
  classeSelect = "",
}: {
  selecao: ReturnType<typeof useSelecaoPrevia>;
  className?: string;
  classeSelect?: string;
}) {
  const estilo =
    classeSelect ||
    "h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/30";
  if (selecao.erroPrevias) {
    return <span className="text-xs font-semibold text-rose-600">{selecao.erroPrevias}</span>;
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Competência
        <select
          id="filtro-competencia-previa"
          className={estilo}
          value={selecao.competencia}
          disabled={selecao.carregandoPrevias}
          onChange={(e) => selecao.selecionarCompetencia(e.target.value)}
        >
          {selecao.carregandoPrevias && <option value="">Carregando…</option>}
          {selecao.competencias.map((c) => (
            <option key={c} value={c}>
              {rotuloCompetenciaCurto(c, selecao.previas)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
        Prévia
        <select
          id="filtro-numero-previa"
          className={estilo}
          value={selecao.numero || ""}
          disabled={selecao.carregandoPrevias}
          onChange={(e) => selecao.selecionarNumero(Number(e.target.value))}
        >
          {selecao.previasDaCompetencia.map((p) => (
            <option key={p.numero} value={p.numero}>
              {rotuloPreviaComDatas(p)}
              {p.ajustadaManual ? " (ajustada)" : ""}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
