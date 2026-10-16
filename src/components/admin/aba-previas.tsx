"use client";

/**
 * SGP — Administração › Prévias da competência.
 *
 * Mostra as datas oficiais das prévias (tabela previa_competencia). Ajuste manual é
 * EXCEÇÃO: somente o perfil Premier/Administração, com motivo obrigatório. O servidor
 * bloqueia sobreposição e dias sem prévia (validarPreviasCompetencia).
 */

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Save, RotateCcw, AlertTriangle, Lock } from "lucide-react";
import type { Previa } from "@/lib/servicos/previas";
import { formatarDataBr } from "@/lib/servicos/previas";

interface Props {
  onNotificar: (msg: string, erro?: boolean) => void;
}

type Edicao = Record<number, { dataInicio: string; dataFim: string }>;

export function AbaPrevias({ onNotificar }: Props) {
  const [previas, setPrevias] = useState<Previa[]>([]);
  const [podeAjustar, setPodeAjustar] = useState(false);
  const [competencia, setCompetencia] = useState("");
  const [edicao, setEdicao] = useState<Edicao>({});
  const [motivo, setMotivo] = useState("");
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);

  const carregar = async (manterCompetencia?: string) => {
    setCarregando(true);
    try {
      const res = await fetch("/api/previas", { cache: "no-store" });
      const dados = await res.json();
      if (!res.ok || !dados.sucesso) throw new Error(dados.erro || "Falha ao carregar as prévias.");
      setPrevias(dados.previas || []);
      setPodeAjustar(Boolean(dados.podeAjustar));
      setCompetencia(manterCompetencia || dados.previaDaData.competencia);
    } catch (e: any) {
      onNotificar(e?.message || "Falha ao carregar as prévias.", true);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const competencias = useMemo(
    () => Array.from(new Set(previas.map((p) => p.competencia))).sort(),
    [previas]
  );
  const daCompetencia = useMemo(
    () => previas.filter((p) => p.competencia === competencia).sort((a, b) => a.numero - b.numero),
    [previas, competencia]
  );

  useEffect(() => {
    const ed: Edicao = {};
    daCompetencia.forEach((p) => (ed[p.numero] = { dataInicio: p.dataInicio, dataFim: p.dataFim }));
    setEdicao(ed);
    setMotivo("");
    setErros([]);
  }, [daCompetencia]);

  const alterado = daCompetencia.some(
    (p) => edicao[p.numero] && (edicao[p.numero].dataInicio !== p.dataInicio || edicao[p.numero].dataFim !== p.dataFim)
  );

  const salvar = async () => {
    setErros([]);
    if (motivo.trim().length < 5) {
      setErros(["O motivo do ajuste é obrigatório (mínimo de 5 caracteres)."]);
      return;
    }
    setSalvando(true);
    try {
      const res = await fetch("/api/previas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          competencia,
          motivo: motivo.trim(),
          previas: [1, 2, 3].map((n) => ({ numero: n, ...edicao[n] })),
        }),
      });
      const ret = await res.json().catch(() => ({}));
      if (!res.ok || !ret.sucesso) {
        setErros(ret.erros?.length ? ret.erros : [ret.erro || "Falha ao salvar o ajuste."]);
        return;
      }
      onNotificar(`Prévias da competência ${competencia} ajustadas.`);
      await carregar(competencia);
    } finally {
      setSalvando(false);
    }
  };

  const rotuloComp = (c: string) => {
    const [a, m] = c.split("-");
    return `${m}/${a}`;
  };

  return (
    <div className="bg-white border border-[#E3E6EB] rounded-xl shadow-2xs">
      <div className="p-4 border-b border-[#E3E6EB] flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-[#1A2230] flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-[#1F4FD1]" />
            Prévias da competência (períodos de conferência)
          </h2>
          <p className="text-xs text-[#5B6474] mt-0.5">
            Regra padrão: 1ª prévia de 10 a 19; 2ª de 20 a 29 (ou último dia do mês); 3ª do dia seguinte até 09 do mês seguinte.
          </p>
        </div>
        <label className="text-xs font-semibold text-[#5B6474] flex items-center gap-2">
          Competência
          <select
            id="admin-previas-competencia"
            value={competencia}
            onChange={(e) => setCompetencia(e.target.value)}
            disabled={carregando}
            className="h-9 rounded-lg border border-[#E3E6EB] bg-white px-2.5 text-xs font-semibold text-[#1A2230]"
          >
            {competencias.map((c) => (
              <option key={c} value={c}>
                {rotuloComp(c)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="p-4 space-y-4">
        {!podeAjustar && (
          <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
            <Lock className="w-4 h-4 shrink-0" />
            Somente o perfil Premier/Administração pode alterar as datas das prévias. Visualização apenas.
          </div>
        )}

        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[#5B6474] border-b border-[#E3E6EB]">
              <th className="py-2 pr-3">Prévia</th>
              <th className="py-2 pr-3">Início</th>
              <th className="py-2 pr-3">Fim</th>
              <th className="py-2 pr-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {daCompetencia.map((p) => (
              <tr key={p.numero} className="border-b border-[#F0F2F5]">
                <td className="py-2 pr-3 font-bold text-[#1A2230]">{p.numero}ª prévia</td>
                {(["dataInicio", "dataFim"] as const).map((campo) => (
                  <td key={campo} className="py-2 pr-3">
                    {podeAjustar ? (
                      <input
                        id={`admin-previa-${p.numero}-${campo}`}
                        type="date"
                        value={edicao[p.numero]?.[campo] || ""}
                        onChange={(e) =>
                          setEdicao((ant) => ({ ...ant, [p.numero]: { ...ant[p.numero], [campo]: e.target.value } }))
                        }
                        className="h-8 rounded-md border border-[#E3E6EB] px-2 text-xs"
                      />
                    ) : (
                      formatarDataBr(p[campo])
                    )}
                  </td>
                ))}
                <td className="py-2 pr-3">
                  {p.ajustadaManual ? (
                    <span className="text-amber-800 font-semibold" title={p.motivoAjuste || ""}>
                      Ajustada manualmente{p.motivoAjuste ? ` — ${p.motivoAjuste}` : ""}
                    </span>
                  ) : (
                    <span className="text-emerald-700 font-semibold">Regra padrão</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {podeAjustar && (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-[#1A2230]">
              Motivo do ajuste (obrigatório)
              <textarea
                id="admin-previas-motivo"
                rows={2}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Ex.: feriado prolongado — fiscalização solicitou encerrar a 1ª prévia em 18/09."
                className="mt-1 w-full rounded-lg border border-[#E3E6EB] p-2 text-xs font-normal"
              />
            </label>

            {erros.length > 0 && (
              <div className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-2.5 space-y-1">
                {erros.map((e, i) => (
                  <div key={i} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    <span>{e}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                id="admin-previas-desfazer"
                type="button"
                disabled={!alterado || salvando}
                onClick={() => {
                  const ed: Edicao = {};
                  daCompetencia.forEach((p) => (ed[p.numero] = { dataInicio: p.dataInicio, dataFim: p.dataFim }));
                  setEdicao(ed);
                  setErros([]);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E3E6EB] text-[#5B6474] disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Desfazer
              </button>
              <button
                id="admin-previas-salvar"
                type="button"
                disabled={!alterado || salvando}
                onClick={salvar}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#1F4FD1] text-white disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" /> {salvando ? "Salvando…" : "Salvar ajuste"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
