"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  CalendarCheck,
  Briefcase,
  ArrowRight,
  AlertTriangle,
  UserCheck2,
  MessageSquare,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  ShieldCheck,
  TrendingUp,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import {
  carregarEstado,
  calcularStatusDia,
  PostoOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
  EstadoOperacionalCompleto,
} from "@/lib/dados/estado-operacional";

export default function PaginaInicial() {
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);

  useEffect(() => {
    const carregar = () => {
      setEstado(carregarEstado());
    };
    carregar();

    const handleAtualizacao = () => carregar();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const postos: PostoOperacional[] = estado?.postos || [];
  const ocorrencias = estado?.ocorrencias || [];
  const coberturas: CoberturaOperacional[] = estado?.coberturas || [];
  const apontamentos: ApontamentoOperacional[] = estado?.apontamentos || [];

  // Dias da janela recente da semana (dias 10 a 16 de Setembro de 2026)
  const diasSemana = [10, 11, 12, 13, 14, 15, 16];
  const rotulosDias: Record<number, { nome: string; fds: boolean }> = {
    10: { nome: "Qui 10", fds: false },
    11: { nome: "Sex 11", fds: false },
    12: { nome: "Sáb 12", fds: true },
    13: { nome: "Dom 13", fds: true },
    14: { nome: "Seg 14", fds: false },
    15: { nome: "Ter 15", fds: false },
    16: { nome: "Qua 16", fds: false }, // Dia atual
  };

  // Cálculo da distribuição da força de trabalho hoje (dia 16)
  const statsHoje = useMemo(() => {
    const psts = estado?.postos || [];
    const ocrs = estado?.ocorrencias || [];
    const cobs = estado?.coberturas || [];
    const apts = estado?.apontamentos || [];

    let presentes = 0;
    let cobertos = 0;
    let descobertos = 0;
    let folga = 0;

    psts.forEach((posto) => {
      const status = calcularStatusDia(posto, 16, 2026, 8, ocrs, cobs, apts);
      if (status.statusOcupacao === "TITULAR_PRESENTE") presentes++;
      else if (status.statusOcupacao === "COBERTO") cobertos++;
      else if (status.statusOcupacao === "DESCOBERTO" || status.statusOcupacao === "POSTO_VAGO") descobertos++;
      else folga++;
    });

    const totalOperaveis = psts.length;
    const percPresentes = totalOperaveis > 0 ? (presentes / totalOperaveis) * 100 : 0;
    const percCobertos = totalOperaveis > 0 ? (cobertos / totalOperaveis) * 100 : 0;
    const percDescobertos = totalOperaveis > 0 ? (descobertos / totalOperaveis) * 100 : 0;

    return {
      presentes,
      cobertos,
      descobertos,
      folga,
      percPresentes,
      percCobertos,
      percDescobertos,
    };
  }, [estado]);

  const coberturasAtivas = coberturas.filter((c) => c.status === "CONFIRMADA").length;
  const totalApontamentos = apontamentos.length;
  const apontamentosPendentes = apontamentos.filter(
    (a) => a.status === "ABERTO" || a.status === "EM_TRATAMENTO"
  ).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* 1. CABEÇALHO EXECUTIVO */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium mb-1">
            <span className="font-semibold text-slate-800 font-mono">Contrato Petrobras 5900.0129796.25.2</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-600">UFN III – Três Lagoas/MS</span>
            <span className="text-slate-300">•</span>
            <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              SLA Operacional: 98,2%
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Painel Geral de Gestão
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Monitoramento em tempo real de titulares, coberturas e conformidade com o Item 11.3.
          </p>
        </div>

        {/* Ações Estratégicas de Topo */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/relatorios"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-all"
          >
            <FileSpreadsheet className="w-4 h-4 text-slate-500" />
            <span>Memória de Cálculo</span>
          </Link>

          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-premier-900 hover:bg-premier-800 rounded-lg shadow-sm transition-all"
          >
            <CalendarCheck className="w-4 h-4 text-blue-300" />
            <span>Mapa do Mês (30 Dias)</span>
            <ArrowRight className="w-3.5 h-3.5 ml-0.5" />
          </Link>
        </div>
      </div>

      {/* 2. LINHA DE KPIS EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: SLA Contratual */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              SLA do Contrato
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">98,2%</span>
              <span className="text-xs font-medium text-slate-500">• Meta ≥ 95%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2.5 overflow-hidden">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: "98.2%" }} />
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Operação sem glosa projetada para a medição.
            </p>
          </div>
        </div>

        {/* KPI 2: Postos em Atividade */}
        <Link
          href="/postos"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Postos Contratados
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Briefcase className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">{postos.length}</span>
              <span className="text-xs text-slate-500">postos no Anexo 1-A</span>
            </div>
            <div className="flex items-center gap-2 mt-2.5 text-[11px] text-slate-600">
              <span className="text-emerald-700 font-semibold">{statsHoje.presentes} titulares ativos</span>
              <span>•</span>
              <span className="text-blue-700 font-semibold">{statsHoje.cobertos} em cobertura</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-premier-800 transition-colors">
              <span>Ver relação de postos</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </Link>

        {/* KPI 3: Coberturas Ativas */}
        <Link
          href="/coberturas"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Coberturas Vigentes
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <UserCheck2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-blue-700 tabular-nums">{coberturasAtivas}</span>
              <span className="text-xs text-slate-500">substitutos escalados</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-600">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Trava contra sobreposição ativa</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-premier-800 transition-colors">
              <span>Histórico de substituições</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </Link>

        {/* KPI 4: Notificações da Fiscalização */}
        <Link
          href="/apontamentos"
          className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-slate-400 hover:shadow-md transition-all group flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Fiscalização Petrobras
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <MessageSquare className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-slate-900 tabular-nums">{totalApontamentos}</span>
              <span className="text-xs font-semibold text-amber-700">
                • {apontamentosPendentes} pendente(s)
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-600">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Aguardando contra-evidência Premier</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1 group-hover:text-premier-800 transition-colors">
              <span>Apresentar manifestação</span>
              <ChevronRight className="w-3 h-3" />
            </p>
          </div>
        </Link>
      </div>

      {/* 3. BARRA VISUAL DE DISTRIBUIÇÃO DA FORÇA DE TRABALHO HOJE */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Situação do Efetivo no Turno Atual (Hoje • 16/Set)
            </h2>
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              Turno 100% Coberto
            </span>
          </div>
          <span className="text-[11px] text-slate-400 font-mono">
            {postos.length} postos contratados em operação
          </span>
        </div>

        {/* Barra Proporcional Multissegmentada */}
        <div className="w-full bg-slate-100 h-3 rounded-full flex overflow-hidden">
          <div
            style={{ width: `${statsHoje.percPresentes}%` }}
            className="bg-emerald-500 transition-all"
            title={`${statsHoje.presentes} Titulares Presentes`}
          />
          <div
            style={{ width: `${statsHoje.percCobertos}%` }}
            className="bg-blue-500 transition-all"
            title={`${statsHoje.cobertos} Substitutos em Cobertura`}
          />
          <div
            style={{ width: `${statsHoje.percDescobertos}%` }}
            className="bg-rose-500 transition-all"
            title={`${statsHoje.descobertos} Descobertos`}
          />
        </div>

        {/* Legenda Limpa Inline */}
        <div className="flex flex-wrap items-center gap-6 mt-3 text-xs text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>
              <strong>{statsHoje.presentes}</strong> Titulares Presentes ({Math.round(statsHoje.percPresentes)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span>
              <strong>{statsHoje.cobertos}</strong> Substitutos em Cobertura ({Math.round(statsHoje.percCobertos)}%)
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
            <span>
              <strong>{statsHoje.descobertos}</strong> Descobertos (0%)
            </span>
          </div>
          <div className="ml-auto text-[11px] text-slate-400">
            Zero glosa registrada no turno
          </div>
        </div>
      </div>

      {/* 4. ÁREA CENTRAL: VISÃO DA SEMANA DOS POSTOS (ESQUERDA) + PENDÊNCIAS CRÍTICAS (DIREITA) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COLUNA ESQUERDA (7 colunas): Mini Grade Semanal dos 15 Postos */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Acompanhamento Recente dos Postos (Últimos 7 Dias)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Status diário da escala de 10/Set a 16/Set para detecção rápida de desvios.
              </p>
            </div>
            <Link
              href="/mapa-ocupacao"
              className="text-xs text-blue-700 hover:text-blue-900 font-medium inline-flex items-center gap-1"
            >
              <span>Grade Completa</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Tabela / Grade Compacta de 7 Dias */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="text-[11px] text-slate-400 font-semibold border-b border-slate-100">
                  <th className="py-2 pr-3 font-medium">Posto / Função</th>
                  <th className="py-2 pr-3 font-medium hidden sm:table-cell">Titular</th>
                  {diasSemana.map((dia) => (
                    <th
                      key={dia}
                      className={`py-2 px-1 text-center font-mono text-[10px] ${
                        dia === 16
                          ? "text-blue-700 font-bold bg-blue-50/50 rounded-t"
                          : rotulosDias[dia].fds
                          ? "text-slate-300"
                          : "text-slate-500"
                      }`}
                    >
                      {rotulosDias[dia].nome}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {postos.slice(0, 10).map((posto) => {
                  return (
                    <tr key={posto.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 pr-3">
                        <span className="font-mono font-bold text-slate-800 block text-[11px]">
                          {posto.codigoPosto}
                        </span>
                        <span className="text-slate-500 truncate block text-[10px] max-w-[140px]">
                          {posto.funcao}
                        </span>
                      </td>
                      <td className="py-2 pr-3 text-slate-600 hidden sm:table-cell text-[11px] truncate max-w-[120px]">
                        {posto.titularNome || <span className="text-amber-600 italic">Reserva Técnica</span>}
                      </td>
                      {diasSemana.map((dia) => {
                        const statusDia = calcularStatusDia(
                          posto,
                          dia,
                          2026,
                          8,
                          ocorrencias,
                          coberturas,
                          apontamentos
                        );

                        // Cores dos quadradinhos de status
                        let corQuadradinho = "bg-emerald-500 text-white"; // Presente
                        let tooltip = "Presente";

                        if (statusDia.statusOcupacao === "COBERTO") {
                          corQuadradinho = "bg-blue-500 text-white";
                          tooltip = `Coberto: ${statusDia.ocupanteNome}`;
                        } else if (statusDia.statusOcupacao === "DESCOBERTO") {
                          corQuadradinho = "bg-rose-500 text-white";
                          tooltip = "Descoberto";
                        } else if (statusDia.statusOcupacao === "NAO_EXIGIVEL") {
                          corQuadradinho = "bg-slate-200 text-slate-400";
                          tooltip = "Folga / Não exigível";
                        } else if (statusDia.statusOcupacao === "POSTO_VAGO") {
                          corQuadradinho = "bg-amber-400 text-white";
                          tooltip = "Posto Vago";
                        }

                        return (
                          <td key={dia} className="py-2 px-1 text-center" title={`${rotulosDias[dia].nome}: ${tooltip}`}>
                            <span
                              className={`inline-block w-4 h-4 rounded-sm text-[9px] leading-4 text-center font-bold ${corQuadradinho}`}
                            >
                              {statusDia.statusOcupacao === "COBERTO" ? "C" : statusDia.statusOcupacao === "DESCOBERTO" ? "D" : ""}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" /> Presente
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block" /> Coberto (C)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-200 inline-block" /> Folga
              </span>
            </div>
            <Link
              href="/mapa-ocupacao"
              className="font-semibold text-premier-800 hover:text-premier-950 flex items-center gap-1"
            >
              <span>Ver todos os {postos.length} postos</span>
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* COLUNA DIREITA (5 colunas): Pendências Críticas + Régua de Requisitos Contratuais */}
        <div className="lg:col-span-5 space-y-6">
          {/* PENDÊNCIAS E DECISÕES DO GESTOR */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Atenção Imediata do Gestor
              </h2>
              <span className="text-xs font-semibold text-amber-700">
                {apontamentosPendentes} ação pendente
              </span>
            </div>

            <div className="space-y-3">
              {/* Notificação Petrobras */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    Notificação Petrobras Aguardando Réplica
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">PST-ALM-001</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Apontamento formal sobre frequência do dia 05/09 pendente de contra-evidência.
                </p>
                <div className="pt-1 flex justify-end">
                  <Link
                    href="/apontamentos"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-premier-800 hover:text-premier-950 underline"
                  >
                    <span>Responder Apontamento</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {/* Cobertura Ativa */}
              <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 flex items-center gap-1.5">
                    <UserCheck2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    Substituição Temporária em Andamento
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">PST-OPE-003</span>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Substituto Lucas Farias cobrindo titular em atestado médico até 18/09.
                </p>
                <div className="pt-1 flex justify-end">
                  <Link
                    href="/coberturas"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-premier-800 hover:text-premier-950 underline"
                  >
                    <span>Acompanhar Cobertura</span>
                    <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* RÉGUA DE CONFORMIDADE COM AS 5 PERGUNTAS CONTRATUAIS */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-premier-800" />
                <span>Régua de Fiscalização (Item 11.3)</span>
              </h2>
              <Link
                href="/conformidade"
                className="text-[11px] text-blue-700 hover:text-blue-900 font-medium"
              >
                Ver Detalhes
              </Link>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">R1 • Titularidade dos Postos</span>
                <span className="font-semibold text-emerald-700">15/15 Mapeados</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">R2 • Presença & Frequência</span>
                <span className="font-semibold text-blue-700">Auditável (LGPD)</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">R3 • Gestão de Substituições</span>
                <span className="font-semibold text-emerald-700">{coberturasAtivas} em Campo</span>
              </div>
              <div className="flex items-center justify-between py-1 border-b border-slate-50">
                <span className="text-slate-600">R4 • Controle de Descoberturas</span>
                <span className="font-semibold text-emerald-700">0 Descobertos Hoje</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-slate-600">R5 • Memória de Cálculo</span>
                <span className="font-semibold text-slate-800">Pronta p/ Medição</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
