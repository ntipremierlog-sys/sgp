"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  X,
  Clock,
  MessageSquare,
} from "lucide-react";
import { BadgeStatus, StatusOcupacao } from "@/components/ui/badge-status";
import {
  carregarEstado,
  calcularStatusDia,
  PostoOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
  OcupacaoDiaDetalhada,
} from "@/lib/dados/estado-operacional";

export default function MapaOcupacaoPage() {
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [apontamentos, setApontamentos] = useState<ApontamentoOperacional[]>([]);

  // Filtros
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState<string>("TODOS");
  const [filtroEscala, setFiltroEscala] = useState<string>("TODAS");

  // Drawer / Inspeção de Célula
  const [detalheCelula, setDetalheCelula] = useState<OcupacaoDiaDetalhada | null>(null);

  const carregarDados = () => {
    const estado = carregarEstado();
    setPostos(estado.postos);
    setOcorrencias(estado.ocorrencias);
    setCoberturas(estado.coberturas);
    setApontamentos(estado.apontamentos);
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  // Setembro de 2026 possui 30 dias
  const diasDoMes = Array.from({ length: 30 }, (_, i) => i + 1);

  const getNomeDiaSemana = (dia: number) => {
    const data = new Date(2026, 8, dia); // 8 = Setembro
    const nomes = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];
    return nomes[data.getDay()];
  };

  const isFimDeSemana = (dia: number) => {
    const data = new Date(2026, 8, dia);
    const day = data.getDay();
    return day === 0 || day === 6;
  };

  const isFeriado = (dia: number) => {
    return dia === 7; // 07/09 Independência
  };

  // Filtragem dos postos
  const postosFiltrados = postos.filter((p) => {
    const matchTexto =
      p.codigoPosto.toLowerCase().includes(busca.toLowerCase()) ||
      p.funcao.toLowerCase().includes(busca.toLowerCase()) ||
      (p.titularNome && p.titularNome.toLowerCase().includes(busca.toLowerCase())) ||
      (p.titularMatricula && p.titularMatricula.toLowerCase().includes(busca.toLowerCase()));

    const matchEscala = filtroEscala === "TODAS" || p.escala === filtroEscala;

    if (!matchTexto || !matchEscala) return false;

    // Filtro por status (verifica se algum dia do mês tem o status selecionado)
    if (filtroStatus !== "TODOS") {
      let temStatus = false;
      for (const d of diasDoMes) {
        const ocup = calcularStatusDia(p, d, 2026, 8, ocorrencias, coberturas, apontamentos);
        if (ocup.statusOcupacao === filtroStatus) {
          temStatus = true;
          break;
        }
      }
      return temStatus;
    }

    return true;
  });

  // Estatísticas do Mapa
  let totalPresentes = 0;
  let totalCobertos = 0;
  let totalDescobertos = 0;

  postos.forEach((p) => {
    for (let d = 1; d <= 15; d++) {
      const oc = calcularStatusDia(p, d, 2026, 8, ocorrencias, coberturas, apontamentos);
      if (oc.statusOcupacao === "TITULAR_PRESENTE") totalPresentes++;
      else if (oc.statusOcupacao === "COBERTO") totalCobertos++;
      else if (oc.statusOcupacao === "DESCOBERTO") totalDescobertos++;
    }
  });

  const diáriasEfetivas = totalPresentes + totalCobertos;
  const taxaCumprimento =
    diáriasEfetivas + totalDescobertos > 0
      ? Math.round((diáriasEfetivas / (diáriasEfetivas + totalDescobertos)) * 100)
      : 100;

  // Função para obter ícone e classe da célula compacta
  const getCelulaEstilo = (status: StatusOcupacao) => {
    switch (status) {
      case "TITULAR_PRESENTE":
        return {
          sigla: "P",
          bg: "bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300",
          dot: "bg-emerald-500",
        };
      case "COBERTO":
        return {
          sigla: "C",
          bg: "bg-blue-100 hover:bg-blue-200 text-blue-900 border-blue-300 font-bold",
          dot: "bg-blue-600",
        };
      case "DESCOBERTO":
        return {
          sigla: "D",
          bg: "bg-rose-100 hover:bg-rose-200 text-rose-900 border-rose-400 font-bold ring-1 ring-rose-400",
          dot: "bg-rose-600",
        };
      case "NAO_EXIGIVEL":
        return {
          sigla: "—",
          bg: "bg-slate-100 hover:bg-slate-200 text-slate-400 border-slate-200",
          dot: "bg-slate-300",
        };
      case "POSTO_VAGO":
        return {
          sigla: "V",
          bg: "bg-orange-100 hover:bg-orange-200 text-orange-900 border-orange-300",
          dot: "bg-orange-500",
        };
      case "PENDENTE_APURACAO":
        return {
          sigla: "?",
          bg: "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-200",
          dot: "bg-amber-400",
        };
      default:
        return {
          sigla: "-",
          bg: "bg-slate-100 text-slate-500 border-slate-200",
          dot: "bg-slate-400",
        };
    }
  };

  const handleExportarXlsx = () => {
    // Gerar CSV tabular das ocupações
    let csv = "Codigo_Posto;Funcao;Escala;Titular;Dia;Data;Status;Ocupante;Justificativa\n";
    postos.forEach((p) => {
      diasDoMes.forEach((d) => {
        const det = calcularStatusDia(p, d, 2026, 8, ocorrencias, coberturas, apontamentos);
        csv += `${p.codigoPosto};"${p.funcao}";${p.escala};"${p.titularNome || "VAGO"}";${d};${det.data};${det.statusOcupacao};"${det.ocupanteNome || ""}";"${det.motivoPublico.replace(/"/g, '""')}"\n`;
      });
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Mapa_Ocupacao_UFN3_Setembro_2026.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-full mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <CalendarCheck className="w-6 h-6 text-blue-600" />
            <h1>Mapa de Ocupação Diária do Posto</h1>
            <span className="text-xs bg-amber-100 text-amber-900 border border-amber-300 font-semibold px-2 py-0.5 rounded">
              Recurso Central Contratual
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Grade analítica: Postos (linhas) × Dias da Competência (colunas). Status auditável dia a dia para subsidiar a Memória de Cálculo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportarXlsx}
            className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar Grade (CSV / XLSX)</span>
          </button>
        </div>
      </div>

      {/* Cartões de Métricas da Competência */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Postos no Mapa</div>
          <div className="mt-1 text-2xl font-bold text-slate-900 tabular-nums">{postos.length}</div>
          <div className="text-[10px] text-slate-400">UFN III – Três Lagoas/MS</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase">Titular Presente</div>
          <div className="mt-1 text-2xl font-bold text-emerald-700 tabular-nums">{totalPresentes}</div>
          <div className="text-[10px] text-slate-400">Diárias regulares (01 a 15/09)</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-blue-700 uppercase">Postos Cobertos</div>
          <div className="mt-1 text-2xl font-bold text-blue-700 tabular-nums">{totalCobertos}</div>
          <div className="text-[10px] text-slate-400">Substitutos confirmados</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-rose-700 uppercase">Descobertos (Glosas)</div>
          <div className="mt-1 text-2xl font-bold text-rose-700 tabular-nums">{totalDescobertos}</div>
          <div className="text-[10px] text-rose-600 font-semibold">Gera desconto na medição</div>
        </div>

        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
          <div className="text-[11px] font-semibold text-slate-700 uppercase">Taxa de Ocupação</div>
          <div className="mt-1 text-2xl font-bold text-premier-900 tabular-nums">{taxaCumprimento}%</div>
          <div className="text-[10px] text-emerald-600 font-semibold">Aderência aos postos exigíveis</div>
        </div>
      </div>

      {/* Barra de Filtros Persistentes */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por código do posto, função ou titular..."
            className="bg-transparent border-none outline-none w-full text-slate-800 placeholder:text-slate-400"
          />
          {busca && (
            <button onClick={() => setBusca("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Competência:</span>
            <select className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-semibold outline-none">
              <option>Setembro / 2026 (Competência Vigente)</option>
              <option>Agosto / 2026</option>
              <option>Julho / 2026</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Status:</span>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="DESCOBERTO">Descobertos (Crítico / Glosa)</option>
              <option value="COBERTO">Cobertos por Substituto</option>
              <option value="TITULAR_PRESENTE">Titular Presente</option>
              <option value="POSTO_VAGO">Posto Vago</option>
              <option value="PENDENTE_APURACAO">Pendente Apuração</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Escala:</span>
            <select
              value={filtroEscala}
              onChange={(e) => setFiltroEscala(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none"
            >
              <option value="TODAS">Todas</option>
              <option value="5x2">5x2</option>
              <option value="12x36">12x36</option>
              <option value="6x1">6x1</option>
            </select>
          </div>
        </div>
      </div>

      {/* Legenda Resumida Rápida */}
      <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
        <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">Legenda:</span>
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 rounded bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold flex items-center justify-center text-[10px]">
            P
          </span>
          <span className="text-[11px] text-slate-700">Titular Presente</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 rounded bg-blue-100 text-blue-900 border border-blue-300 font-bold flex items-center justify-center text-[10px]">
            C
          </span>
          <span className="text-[11px] text-slate-700">Coberto</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 rounded bg-rose-100 text-rose-900 border border-rose-400 font-bold flex items-center justify-center text-[10px] ring-1 ring-rose-400">
            D
          </span>
          <span className="text-[11px] text-rose-700 font-bold">Descoberto (Glosa)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 rounded bg-slate-100 text-slate-400 border border-slate-200 font-bold flex items-center justify-center text-[10px]">
            —
          </span>
          <span className="text-[11px] text-slate-500">Não Exigível (Folga)</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 rounded bg-orange-100 text-orange-900 border border-orange-300 font-bold flex items-center justify-center text-[10px]">
            V
          </span>
          <span className="text-[11px] text-slate-700">Posto Vago</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-5 h-5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold flex items-center justify-center text-[10px]">
            ?
          </span>
          <span className="text-[11px] text-slate-700">Pendente</span>
        </div>
      </div>

      {/* Grade Central do Mapa de Ocupação */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {/* Linha 1: Dias da Semana */}
              <tr className="bg-slate-100 border-b border-slate-200 text-slate-500 text-[10px] font-bold">
                <th className="py-1 px-3 sticky left-0 z-20 bg-slate-100 min-w-[200px] border-r border-slate-300">
                  POSTO / FUNÇÃO CONTRATUAL
                </th>
                <th className="py-1 px-2 sticky left-[200px] z-20 bg-slate-100 min-w-[150px] border-r border-slate-300">
                  TITULAR OFICIAL
                </th>
                <th className="py-1 px-1.5 text-center min-w-[45px] border-r border-slate-300">
                  ESC
                </th>
                {diasDoMes.map((dia) => {
                  const fds = isFimDeSemana(dia);
                  const feriado = isFeriado(dia);
                  return (
                    <th
                      key={`sem-${dia}`}
                      className={`py-1 text-center min-w-[32px] w-8 border-r border-slate-200 ${
                        feriado
                          ? "bg-amber-100 text-amber-900 font-extrabold"
                          : fds
                          ? "bg-slate-200/70 text-slate-600"
                          : ""
                      }`}
                    >
                      {getNomeDiaSemana(dia)}
                    </th>
                  );
                })}
              </tr>

              {/* Linha 2: Números dos Dias */}
              <tr className="bg-slate-50 border-b border-slate-300 text-slate-800 text-xs font-bold">
                <th className="py-2 px-3 sticky left-0 z-20 bg-slate-50 border-r border-slate-300">
                  Código do Posto
                </th>
                <th className="py-2 px-2 sticky left-[200px] z-20 bg-slate-50 border-r border-slate-300">
                  Matrícula e Nome
                </th>
                <th className="py-2 px-1.5 text-center border-r border-slate-300">
                  Jorn.
                </th>
                {diasDoMes.map((dia) => {
                  const fds = isFimDeSemana(dia);
                  const feriado = isFeriado(dia);
                  return (
                    <th
                      key={`num-${dia}`}
                      className={`py-2 text-center border-r border-slate-200 font-mono text-[11px] ${
                        feriado
                          ? "bg-amber-100 text-amber-950 font-bold"
                          : fds
                          ? "bg-slate-200/70 text-slate-700 font-bold"
                          : "text-slate-900"
                      }`}
                      title={feriado ? "07/09: Feriado Nacional - Independência" : undefined}
                    >
                      {String(dia).padStart(2, "0")}
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {postosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={33} className="py-12 text-center text-slate-500">
                    Nenhum posto atende aos critérios do filtro selecionado.
                  </td>
                </tr>
              ) : (
                postosFiltrados.map((posto) => (
                  <tr key={posto.id} className="hover:bg-blue-50/30 transition-colors">
                    {/* Coluna Fixa 1: Posto */}
                    <td className="py-2 px-3 sticky left-0 z-10 bg-white border-r border-slate-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      <div className="font-mono font-bold text-premier-900 text-[11px]">{posto.codigoPosto}</div>
                      <div className="text-[11px] font-medium text-slate-700 truncate max-w-[180px]" title={posto.funcao}>
                        {posto.funcao}
                      </div>
                    </td>

                    {/* Coluna Fixa 2: Titular */}
                    <td className="py-2 px-2 sticky left-[200px] z-10 bg-white border-r border-slate-300 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]">
                      {posto.titularMatricula ? (
                        <div>
                          <div className="font-semibold text-slate-900 truncate max-w-[140px]" title={posto.titularNome}>
                            {posto.titularNome}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500">{posto.titularMatricula}</div>
                        </div>
                      ) : (
                        <span className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1.5 py-0.5 rounded border border-orange-200">
                          POSTO VAGO
                        </span>
                      )}
                    </td>

                    {/* Coluna Escala */}
                    <td className="py-2 px-1 text-center font-mono text-[10px] font-bold text-slate-600 border-r border-slate-300">
                      {posto.escala}
                    </td>

                    {/* Colunas dos 30 Dias */}
                    {diasDoMes.map((dia) => {
                      const detalhe = calcularStatusDia(posto, dia, 2026, 8, ocorrencias, coberturas, apontamentos);
                      const estilo = getCelulaEstilo(detalhe.statusOcupacao);
                      const fds = isFimDeSemana(dia);

                      return (
                        <td
                          key={dia}
                          onClick={() => setDetalheCelula(detalhe)}
                          className={`p-0.5 text-center border-r border-slate-200 cursor-pointer select-none transition-transform hover:scale-105 ${
                            fds && detalhe.statusOcupacao === "NAO_EXIGIVEL" ? "bg-slate-100/50" : ""
                          }`}
                          title={`Dia ${dia}/09 - ${posto.codigoPosto} (${posto.funcao})\nStatus: ${detalhe.statusOcupacao}\n${detalhe.motivoPublico}\nClique para ver evidências`}
                        >
                          <div
                            className={`w-7 h-7 mx-auto rounded flex items-center justify-center font-mono text-[11px] font-bold border transition-colors ${estilo.bg}`}
                          >
                            {estilo.sigla}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Drawer Lateral / Modal de Inspeção da Célula */}
      {detalheCelula && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col justify-between border-l border-slate-200 animate-slideLeft overflow-y-auto">
            {/* Topo do Drawer */}
            <div>
              <div className="p-4 bg-premier-900 text-white flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-5 h-5 text-blue-400" />
                    <h3 className="font-bold text-sm">Inspeção de Ocupação Diária</h3>
                  </div>
                  <div className="text-xs text-slate-300 mt-0.5">
                    Data: <strong>{detalheCelula.data}</strong> ({detalheCelula.diaNumero}/09/2026)
                  </div>
                </div>
                <button
                  onClick={() => setDetalheCelula(null)}
                  className="text-slate-300 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Corpo do Drawer */}
              <div className="p-5 space-y-4 text-xs">
                {/* Status Oficial em Destaque */}
                <div className="p-3 rounded-lg border flex items-center justify-between bg-slate-50">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">
                      Status Contratual Apurado
                    </span>
                    <div className="mt-1">
                      <BadgeStatus status={detalheCelula.statusOcupacao} tamanho="lg" />
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-500 block">Integridade</span>
                    <span className="text-emerald-700 font-bold text-[11px] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Auditado
                    </span>
                  </div>
                </div>

                {/* Dados do Posto */}
                <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 font-bold uppercase text-[10px]">Posto do Anexo 1-A</span>
                    <span className="font-mono font-bold text-premier-900 text-xs">
                      {detalheCelula.postoCodigo}
                    </span>
                  </div>
                  <div className="font-semibold text-slate-900 text-sm">{detalheCelula.funcaoPosto}</div>
                </div>

                {/* Titular Oficial */}
                <div className="p-3 rounded bg-slate-50 border border-slate-200 space-y-1">
                  <span className="text-slate-500 font-bold uppercase text-[10px]">Titular Contratual</span>
                  {detalheCelula.titularNome ? (
                    <div>
                      <div className="font-bold text-slate-900">{detalheCelula.titularNome}</div>
                      <div className="text-[11px] font-mono text-slate-500">
                        Matrícula: {detalheCelula.titularMatricula}
                      </div>
                    </div>
                  ) : (
                    <div className="text-orange-700 font-bold">Posto Vago (Sem titular alocado)</div>
                  )}
                </div>

                {/* Se Coberto: Substituto */}
                {detalheCelula.statusOcupacao === "COBERTO" && (
                  <div className="p-3 rounded bg-blue-50/70 border border-blue-200 space-y-1">
                    <span className="text-blue-800 font-bold uppercase text-[10px] flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Profissional Substituto em Campo</span>
                    </span>
                    <div className="font-bold text-blue-950 text-sm">{detalheCelula.ocupanteNome}</div>
                    <div className="text-[11px] font-mono text-blue-700">
                      Matrícula: {detalheCelula.ocupanteMatricula}
                    </div>
                  </div>
                )}

                {/* Se Descoberto: Alerta Crítico */}
                {detalheCelula.statusOcupacao === "DESCOBERTO" && (
                  <div className="p-3.5 rounded bg-rose-50 border border-rose-300 space-y-2 text-rose-900">
                    <div className="flex items-center gap-2 font-bold text-sm text-rose-800">
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>Inconformidade Contratual — Glosa Passível</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      O titular não compareceu ao posto e não houve cobertura tempestiva por profissional substituto da Premier.
                      Esta ausência fundamenta glosa de 1 diária contratual na Memória de Cálculo da Petrobras.
                    </p>
                    <div className="pt-2 border-t border-rose-200 flex items-center justify-between">
                      <span className="text-[10px] font-semibold">Impacto Financeiro:</span>
                      <span className="font-mono font-bold text-rose-800 text-xs">
                        Glosa de 1/30 avos do valor mensal do posto
                      </span>
                    </div>
                  </div>
                )}

                {/* Evidência Auditável / Motivo Público */}
                <div>
                  <span className="text-slate-500 font-bold uppercase text-[10px]">
                    Evidência Pública & Justificativa (Auditável Petrobras)
                  </span>
                  <p className="mt-1 p-2.5 rounded bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed text-[11px]">
                    {detalheCelula.motivoPublico}
                  </p>
                </div>

                {/* Registros de Ponto Apurados */}
                {detalheCelula.batidas && (
                  <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
                    <span className="text-slate-500 font-bold uppercase text-[10px] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-500" />
                      <span>Registro Eletrônico de Ponto (REP)</span>
                    </span>
                    <div className="grid grid-cols-3 gap-2 text-center pt-1">
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 uppercase">Entrada</span>
                        <div className="font-mono font-bold text-slate-800">{detalheCelula.batidas.entrada}</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 uppercase">Saída</span>
                        <div className="font-mono font-bold text-slate-800">{detalheCelula.batidas.saida}</div>
                      </div>
                      <div className="bg-white p-1.5 rounded border border-slate-200">
                        <span className="text-[9px] text-slate-400 uppercase">Horas</span>
                        <div className="font-mono font-bold text-emerald-700">{detalheCelula.batidas.horas}h</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Rodapé de Ações do Drawer */}
            <div className="p-4 bg-slate-100 border-t border-slate-200 space-y-2">
              {detalheCelula.statusOcupacao === "DESCOBERTO" && (
                <div className="space-y-1.5">
                  <Link
                    href="/apontamentos"
                    className="w-full inline-flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold py-2 rounded text-xs transition-colors shadow"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Abrir Apontamento da Fiscalização</span>
                  </Link>
                  <Link
                    href="/coberturas"
                    className="w-full inline-flex items-center justify-center gap-2 bg-premier-900 hover:bg-premier-800 text-white font-semibold py-2 rounded text-xs transition-colors shadow"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>Designar Cobertura Retroativa</span>
                  </Link>
                </div>
              )}

              <button
                onClick={() => setDetalheCelula(null)}
                className="w-full py-1.5 bg-white hover:bg-slate-200 text-slate-700 font-semibold rounded border border-slate-300 text-xs transition-colors"
              >
                Fechar Painel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
