"use client";

/**
 * SGP — Registros de ponto do dia e Espelho do período (Mapa de Ocupação)
 *
 * LGPD: renderizar somente para perfis Premier. Fiscal Petrobras não acessa
 * marcações individuais (apenas a situação consolidada do posto).
 */

import React, { useMemo } from "react";
import Link from "next/link";
import { Clock, FileSpreadsheet, X, AlertTriangle, LogOut, LogIn, Timer, ExternalLink } from "lucide-react";
import {
  AnaliseJornadaDia,
  ResumoEspelhoPeriodo,
  ROTULO_SITUACAO_JORNADA,
  formatarDuracao,
  minutosParaHora,
} from "@/lib/servicos/analise-jornada";

const DIAS_SEMANA = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

function diaSemana(dataStr: string): string {
  const [y, m, d] = dataStr.split("-").map(Number);
  return DIAS_SEMANA[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function dataBr(dataStr: string): string {
  return dataStr.split("-").reverse().join("/");
}

// -----------------------------------------------------------------------------
// Linha do tempo: previsto × realizado
// -----------------------------------------------------------------------------

export function LinhaTempoJornada({ analise }: { analise: AnaliseJornadaDia }) {
  const { previstoInicioMin: ini, previstoFimMin: fim, batidas, pares } = analise;
  const pontos = [ini, fim, ...batidas.map((b) => b.minutos)].filter((x): x is number => typeof x === "number");
  if (pontos.length === 0) return null;

  const inicioJanela = Math.max(Math.floor((Math.min(...pontos) - 60) / 60) * 60, analise.atravessaMeiaNoite ? -180 : 0);
  const fimJanela = Math.min(Math.ceil((Math.max(...pontos) + 60) / 60) * 60, analise.atravessaMeiaNoite ? 1440 + 720 : 1440);
  const total = Math.max(60, fimJanela - inicioJanela);
  const pct = (m: number) => `${((m - inicioJanela) / total) * 100}%`;
  const larg = (a: number, b: number) => `${(Math.max(0, b - a) / total) * 100}%`;

  const ticks: number[] = [];
  const passo = total > 14 * 60 ? 180 : 120;
  for (let t = Math.ceil(inicioJanela / passo) * passo; t <= fimJanela; t += passo) ticks.push(t);

  const primeira = batidas[0]?.minutos;
  const ultimaSaida = batidas.length >= 2 && batidas.length % 2 === 0 ? batidas[batidas.length - 1].minutos : undefined;

  return (
    <div className="space-y-1" aria-label="Linha do tempo da jornada">
      <div className="relative h-9 rounded-md bg-slate-100 border border-slate-200 overflow-hidden">
        {/* Faixa prevista */}
        {ini !== undefined && fim !== undefined && (
          <div
            className="absolute top-0 bottom-0 bg-blue-100/80 border-x-2 border-blue-400"
            style={{ left: pct(ini), width: larg(ini, fim) }}
            title={`Previsto: ${minutosParaHora(ini)} às ${minutosParaHora(fim)}`}
          />
        )}
        {/* Atraso */}
        {ini !== undefined && primeira !== undefined && primeira > ini && (
          <div
            className="absolute top-1/2 h-3 -translate-y-1/2 bg-[repeating-linear-gradient(45deg,#fda4af_0,#fda4af_4px,#fff1f2_4px,#fff1f2_8px)] border border-rose-300"
            style={{ left: pct(ini), width: larg(ini, Math.min(primeira, fim ?? primeira)) }}
            title={`Atraso: ${formatarDuracao(primeira - ini)}`}
          />
        )}
        {/* Saída antecipada */}
        {fim !== undefined && ultimaSaida !== undefined && ultimaSaida < fim && (
          <div
            className={`absolute top-1/2 h-3 -translate-y-1/2 ${
              analise.compensado
                ? "bg-[repeating-linear-gradient(45deg,#cbd5e1_0,#cbd5e1_4px,#f8fafc_4px,#f8fafc_8px)] border border-slate-300"
                : "bg-[repeating-linear-gradient(45deg,#fdba74_0,#fdba74_4px,#fff7ed_4px,#fff7ed_8px)] border border-orange-400"
            }`}
            style={{ left: pct(Math.max(ultimaSaida, ini ?? ultimaSaida)), width: larg(Math.max(ultimaSaida, ini ?? ultimaSaida), fim) }}
            title={
              analise.compensado
                ? `Saiu ${formatarDuracao(fim - ultimaSaida)} antes do previsto, mas cumpriu a carga horária`
                : `Jornada não concluída: ${formatarDuracao(fim - ultimaSaida)}`
            }
          />
        )}
        {/* Períodos trabalhados */}
        {pares.map((p, i) =>
          p.saida ? (
            <div
              key={i}
              className="absolute top-1/2 h-3 -translate-y-1/2 rounded-sm bg-emerald-500 shadow-xs"
              style={{ left: pct(p.entrada.minutos), width: larg(p.entrada.minutos, p.saida.minutos) }}
              title={`${p.entrada.hora} → ${p.saida.hora} (${formatarDuracao(p.minutos)})`}
            />
          ) : (
            <div
              key={i}
              className="absolute top-1/2 h-3 -translate-y-1/2 w-6 bg-gradient-to-r from-amber-400 to-transparent"
              style={{ left: pct(p.entrada.minutos) }}
              title={`${p.entrada.hora} → saída não registrada`}
            />
          )
        )}
        {/* Marcadores de batida */}
        {batidas.map((b, i) => (
          <div
            key={`m-${i}`}
            className={`absolute top-0 bottom-0 w-0.5 ${i % 2 === 0 ? "bg-emerald-800" : "bg-slate-700"}`}
            style={{ left: pct(b.minutos) }}
            title={`${i % 2 === 0 ? "Entrada" : "Saída"} ${b.hora}${b.diaSeguinte ? " (dia seguinte)" : ""}`}
          />
        ))}
      </div>
      <div className="relative h-3 text-[9px] text-slate-500 font-mono">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: pct(t) }}>
            {minutosParaHora(t)}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-slate-500 pt-1">
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 bg-blue-100 border border-blue-400 inline-block" />Previsto (RM)</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 bg-emerald-500 inline-block rounded-sm" />Trabalhado</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 bg-rose-300 inline-block" />Atraso</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-2 bg-orange-300 inline-block" />Não concluído</span>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// Painel do dia
// -----------------------------------------------------------------------------

export interface PessoaRegistroPonto {
  chapa: string;
  nome: string;
  papel: string; // "Titular", "Substituto/Cobertura", ...
  analise: AnaliseJornadaDia;
}

export function RegistrosPontoDia({
  pessoas,
  pessoaAtiva,
  onSelecionarPessoa,
  onAbrirEspelho,
}: {
  pessoas: PessoaRegistroPonto[];
  pessoaAtiva: number;
  onSelecionarPessoa: (idx: number) => void;
  onAbrirEspelho: (idx: number) => void;
}) {
  if (pessoas.length === 0) {
    return (
      <div className="p-3 rounded-lg border border-slate-200 bg-white text-xs text-slate-500" id="registros-ponto-dia">
        Nenhum colaborador vinculado à posição neste dia para consulta de ponto.
      </div>
    );
  }
  const atual = pessoas[Math.min(pessoaAtiva, pessoas.length - 1)];
  const a = atual.analise;
  const rot = ROTULO_SITUACAO_JORNADA[a.situacao];

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-3" id="registros-ponto-dia">
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-700" />
          <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider">Registros de Ponto do Dia</span>
          <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 rounded font-semibold">
            Restrito Premier (LGPD)
          </span>
        </div>
        <button
          id="btn-abrir-espelho-periodo"
          onClick={() => onAbrirEspelho(Math.min(pessoaAtiva, pessoas.length - 1))}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-900 hover:bg-blue-800 text-white text-[11px] font-bold shadow-xs cursor-pointer transition-colors"
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          Espelho completo do período
        </button>
      </div>

      {pessoas.length > 1 && (
        <div className="flex gap-1.5 flex-wrap" role="tablist">
          {pessoas.map((p, i) => (
            <button
              key={p.chapa + i}
              role="tab"
              aria-selected={i === pessoaAtiva}
              onClick={() => onSelecionarPessoa(i)}
              className={`px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer transition-colors ${
                i === pessoaAtiva ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              {p.papel}: {p.nome.split(" ")[0]} ({p.chapa})
            </button>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="text-xs">
          <div className="font-bold text-slate-900">{atual.nome}</div>
          <div className="text-slate-500 font-mono text-[11px]">Chapa {atual.chapa} • {atual.papel}</div>
        </div>
        <span className={`text-[11px] font-semibold ${textoSituacao(rot.classes)}`}>{rot.label}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
        <Metrica rotulo="Previsto" valor={a.previstoInicio ? `${a.previstoInicio} – ${a.previstoFim}` : "—"} />
        <Metrica rotulo="1ª entrada" valor={a.primeiraEntrada || "—"} icone={<LogIn className="w-3 h-3" />} destaque={!a.compensado && a.atrasoMin > a.toleranciaMin ? "rose" : undefined} />
        <Metrica rotulo="Última saída" valor={a.ultimaSaida || (a.batidas.length % 2 === 1 ? "não registrada" : "—")} icone={<LogOut className="w-3 h-3" />} destaque={!a.compensado && a.saidaAntecipadaMin > a.toleranciaMin ? "orange" : undefined} />
        <Metrica
          rotulo="Efetivo / carga"
          valor={a.minutosEfetivos || a.cargaPrevistaMin ? `${a.minutosEfetivos ? formatarDuracao(a.minutosEfetivos) : "—"} / ${a.temJornadaPrevista ? formatarDuracao(a.cargaPrevistaMin) : "—"}` : "—"}
          icone={<Timer className="w-3 h-3" />}
        />
        <Metrica rotulo="Não cumprido" valor={a.minutosNaoCumpridos ? formatarDuracao(a.minutosNaoCumpridos) : "—"} destaque={a.minutosNaoCumpridos ? "rose" : undefined} />
      </div>

      {(() => {
        const ehAlerta = ["SAIDA_ANTECIPADA", "ATRASO_E_SAIDA_ANTECIPADA", "ATRASO", "CARGA_INCOMPLETA", "MARCACAO_INCOMPLETA", "SEM_MARCACAO"].includes(a.situacao);
        return ehAlerta ? (
          <div className="flex items-start gap-2 p-2.5 rounded-md border border-orange-200 text-orange-900 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-orange-600" />
            <span>{a.descricao}</span>
          </div>
        ) : (
          <p className="text-[11px] text-slate-600">{a.descricao}</p>
        );
      })()}

      <LinhaTempoJornada analise={a} />

      {a.batidas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead className="text-slate-500 uppercase text-[10px] border-b border-slate-200">
              <tr>
                <th className="text-left py-1 pr-2">#</th>
                <th className="text-left py-1 pr-2">Tipo</th>
                <th className="text-left py-1 pr-2">Hora</th>
                <th className="text-left py-1 pr-2">Data</th>
                <th className="text-left py-1 pr-2">NSR</th>
                <th className="text-left py-1">Origem (lote)</th>
              </tr>
            </thead>
            <tbody className="font-mono divide-y divide-slate-100">
              {a.batidas.map((b, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2 text-slate-400">{i + 1}</td>
                  <td className="py-1 pr-2 font-sans font-semibold">
                    {i % 2 === 0 ? <span className="text-emerald-700">Entrada</span> : <span className="text-slate-700">Saída</span>}
                  </td>
                  <td className="py-1 pr-2 font-bold text-slate-900">{b.hora}</td>
                  <td className="py-1 pr-2">{dataBr(b.dataLocal)}{b.diaSeguinte ? " (+1)" : ""}</td>
                  <td className="py-1 pr-2">{b.nsr || "—"}</td>
                  <td className="py-1 truncate max-w-[200px] text-slate-500" title={b.arquivoOrigem}>{b.loteId || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] text-slate-400">
        Cumprimento medido pela carga horária do posto (faixa prevista − intervalo de {a.intervaloPrevistoMin || 60} min), com tolerância de {a.toleranciaMin} min. Entrada/saída fora do horário com a carga cumprida aparecem como &quot;horário alterado&quot;. Evidência de gestão — não substitui a apuração oficial de ponto.
      </p>
    </div>
  );
}

function Metrica({ rotulo, valor, icone, destaque }: { rotulo: string; valor: string; icone?: React.ReactNode; destaque?: "rose" | "orange" }) {
  const cor = destaque === "rose" ? "text-rose-700" : destaque === "orange" ? "text-orange-700" : "text-slate-900";
  return (
    <div className="rounded border border-slate-200 px-2 py-1.5">
      <span className="text-[9px] text-slate-500 uppercase font-semibold flex items-center gap-1">{icone}{rotulo}</span>
      <span className={`font-mono font-bold text-xs ${cor}`}>{valor}</span>
    </div>
  );
}

/** Mantém só a cor do texto do rótulo de situação (sem fundo/borda). */
function textoSituacao(classes: string): string {
  return classes.split(" ").filter((c) => c.startsWith("text-")).join(" ");
}

// -----------------------------------------------------------------------------
// Modal: Espelho completo do período
// -----------------------------------------------------------------------------

export function ModalEspelhoPeriodo({
  aberto,
  onFechar,
  nome,
  chapa,
  periodoTexto,
  dias,
  resumo,
  statusPosto,
  onSelecionarDia,
}: {
  aberto: boolean;
  onFechar: () => void;
  nome: string;
  chapa: string;
  periodoTexto: string;
  dias: AnaliseJornadaDia[];
  resumo: ResumoEspelhoPeriodo;
  statusPosto?: (dataStr: string) => { sigla: string; classes: string; label: string } | undefined;
  onSelecionarDia?: (dataStr: string) => void;
}) {
  const csv = useMemo(() => {
    const linhas = [
      ["Data", "Dia", "Previsto", "Marcações", "1ª Entrada", "Última Saída", "Atraso", "Saída antecipada", "Tempo efetivo", "Carga prevista", "Não cumprido", "Situação"],
      ...dias.map((d) => [
        dataBr(d.dataStr),
        diaSemana(d.dataStr),
        d.temJornadaPrevista && d.previstoInicio ? `${d.previstoInicio}-${d.previstoFim}` : "",
        d.batidas.map((b) => b.hora).join(" "),
        d.primeiraEntrada || "",
        d.ultimaSaida || "",
        d.atrasoMin > d.toleranciaMin ? formatarDuracao(d.atrasoMin) : "",
        d.saidaAntecipadaMin > d.toleranciaMin ? formatarDuracao(d.saidaAntecipadaMin) : "",
        d.minutosEfetivos ? formatarDuracao(d.minutosEfetivos) : "",
        d.temJornadaPrevista ? formatarDuracao(d.cargaPrevistaMin) : "",
        d.minutosNaoCumpridos ? formatarDuracao(d.minutosNaoCumpridos) : "",
        ROTULO_SITUACAO_JORNADA[d.situacao].label,
      ]),
    ];
    return linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  }, [dias]);

  if (!aberto) return null;

  const baixarCsv = () => {
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `espelho-ponto-${chapa}-${dias[0]?.dataStr || ""}_${dias[dias.length - 1]?.dataStr || ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3" role="dialog" aria-modal="true" aria-labelledby="titulo-espelho-periodo">
      <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-start justify-between gap-3 p-4 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
          <div>
            <h2 id="titulo-espelho-periodo" className="text-base font-bold text-slate-900">Espelho de Ponto do Período</h2>
            <p className="text-xs text-slate-600 mt-0.5">
              <strong>{nome}</strong> • Chapa <span className="font-mono">{chapa}</span> • {periodoTexto}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={baixarCsv} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold cursor-pointer">
              <FileSpreadsheet className="w-3.5 h-3.5" /> Exportar CSV
            </button>
            <Link
              href={`/profissionais/${chapa}/espelho-ponto`}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Página do espelho
            </Link>
            <button onClick={onFechar} className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer" aria-label="Fechar espelho">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 p-4 border-b border-slate-100">
          <Card rotulo="Dias com jornada" valor={String(resumo.diasComJornada)} />
          <Card
            rotulo="Cumpridos"
            valor={String(resumo.diasCumpridos)}
            detalhe={resumo.diasHorarioAlterado > 0 ? `${resumo.diasHorarioAlterado} com horário alterado` : undefined}
            cor="text-emerald-700"
          />
          <Card rotulo="Saída antecipada" valor={String(resumo.diasSaidaAntecipada)} cor="text-orange-700" />
          <Card rotulo="Atrasos" valor={String(resumo.diasAtraso)} cor="text-amber-700" />
          <Card rotulo="Marcação incompleta" valor={String(resumo.diasIncompletos)} cor="text-yellow-700" />
          <Card rotulo="Sem marcação" valor={String(resumo.diasSemMarcacao)} cor="text-rose-700" />
          <Card rotulo="Total não cumprido" valor={formatarDuracao(resumo.minutosNaoCumpridos)} cor="text-rose-700" />
        </div>

        <div className="overflow-auto flex-1">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-100 text-slate-600 uppercase text-[10px] z-10">
              <tr>
                <th className="px-3 py-2 text-left">Data</th>
                <th className="px-2 py-2 text-left">Posto</th>
                <th className="px-2 py-2 text-left">Previsto</th>
                <th className="px-2 py-2 text-left">Marcações</th>
                <th className="px-2 py-2 text-left">Atraso</th>
                <th className="px-2 py-2 text-left">Saída antecipada</th>
                <th className="px-2 py-2 text-left">Efetivo / carga</th>
                <th className="px-2 py-2 text-left">Não cumprido</th>
                <th className="px-3 py-2 text-left">Situação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dias.map((d) => {
                const rot = ROTULO_SITUACAO_JORNADA[d.situacao];
                const st = statusPosto?.(d.dataStr);
                return (
                  <tr
                    key={d.dataStr}
                    className={onSelecionarDia ? "hover:bg-slate-50 cursor-pointer" : ""}
                    onClick={() => onSelecionarDia?.(d.dataStr)}
                    title={d.descricao}
                  >
                    <td className="px-3 py-1.5 font-mono font-semibold whitespace-nowrap">
                      {dataBr(d.dataStr)} <span className="text-slate-400 font-sans text-[10px]">{diaSemana(d.dataStr)}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      {st ? <span className={`inline-block min-w-6 text-center px-1 rounded border text-[10px] font-bold ${st.classes}`} title={st.label}>{st.sigla}</span> : "—"}
                    </td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      {d.temJornadaPrevista && d.previstoInicio ? `${d.previstoInicio}–${d.previstoFim}` : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex flex-wrap gap-1 font-mono">
                        {d.batidas.length === 0 ? (
                          <span className="text-slate-400">—</span>
                        ) : (
                          d.batidas.map((b, i) => (
                            <span key={i} className="px-1 rounded border border-slate-200 text-[10px] text-slate-800">
                              {b.hora}{b.diaSeguinte ? "⁺¹" : ""}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className={`px-2 py-1.5 font-mono ${d.atrasoMin > d.toleranciaMin ? (d.compensado ? "text-slate-400" : "text-amber-700 font-bold") : "text-slate-400"}`}>
                      {d.atrasoMin > d.toleranciaMin ? formatarDuracao(d.atrasoMin) : "—"}
                    </td>
                    <td
                      className={`px-2 py-1.5 font-mono ${d.saidaAntecipadaMin > d.toleranciaMin ? (d.compensado ? "text-slate-400" : "text-orange-700 font-bold") : "text-slate-400"}`}
                      title={d.compensado && d.saidaAntecipadaMin > d.toleranciaMin ? "Compensado: a carga horária do dia foi cumprida" : undefined}
                    >
                      {d.saidaAntecipadaMin > d.toleranciaMin
                        ? `${formatarDuracao(d.saidaAntecipadaMin)} (saiu ${d.ultimaSaida})${d.compensado ? " · compensado" : ""}`
                        : "—"}
                    </td>
                    <td className="px-2 py-1.5 font-mono whitespace-nowrap">
                      {d.minutosEfetivos ? formatarDuracao(d.minutosEfetivos) : "—"}
                      {d.temJornadaPrevista && d.cargaPrevistaMin > 0 && (
                        <span className="text-slate-400"> / {formatarDuracao(d.cargaPrevistaMin)}</span>
                      )}
                    </td>
                    <td className={`px-2 py-1.5 font-mono ${d.minutosNaoCumpridos ? "text-rose-700 font-bold" : "text-slate-400"}`}>
                      {d.minutosNaoCumpridos ? formatarDuracao(d.minutosNaoCumpridos) : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-[11px] font-medium whitespace-nowrap ${textoSituacao(rot.classes)}`}>{rot.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-slate-200 text-[10px] text-slate-500 flex justify-between flex-wrap gap-2">
          <span>Jornada prevista conforme Descrição do Horário (RM). Tolerância de 10 min. ⁺¹ = marcação no dia seguinte (turno noturno).</span>
          {onSelecionarDia && <span>Clique em um dia para abri-lo no painel de inspeção.</span>}
        </div>
      </div>
    </div>
  );
}

function Card({ rotulo, valor, cor = "text-slate-900", detalhe }: { rotulo: string; valor: string; cor?: string; detalhe?: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-2xs">
      <span className="text-[10px] text-slate-500 uppercase font-semibold block">{rotulo}</span>
      <span className={`text-lg font-bold ${cor}`}>{valor}</span>
      {detalhe && <span className="block text-[10px] text-slate-500 leading-tight">{detalhe}</span>}
    </div>
  );
}
