"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Building2,
  Search,
  FilterX,
  History,
  CheckCircle2,
  CalendarCheck,
  Briefcase,
  AlertCircle,
  ExternalLink,
  Plus,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import {
  carregarEstado,
  CoberturaOperacional,
  PostoOperacional,
  ProfissionalOperacional,
  obterTodosPostosContrato,
} from "@/lib/dados/estado-operacional";
import {
  FERISTAS_REV04,
  VINCULOS_FERISTAS_POSTOS,
  FeristaItemREV04,
} from "@/lib/dados/estrutura-postos";

export default function FeristasPage() {
  const [profissionais, setProfissionais] = useState<ProfissionalOperacional[]>([]);
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [perfilAtivo, setPerfilAtivo] = useState<string>("PREMIER_ADMIN");

  // Filtros
  const [filtroUnidade, setFiltroUnidade] = useState<string>("TODAS");
  const [busca, setBusca] = useState<string>("");
  const [feristaSelecionado, setFeristaSelecionado] = useState<string | null>(null);

  const carregarDados = () => {
    const estado = carregarEstado();
    setProfissionais(estado.profissionais || []);
    setPostos(obterTodosPostosContrato(estado.postos));
    setCoberturas(estado.coberturas || []);
    setPerfilAtivo(estado.perfilAtivo || "PREMIER_ADMIN");
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const ehFiscal = perfilAtivo === "PETROBRAS_FISCAL" || perfilAtivo.startsWith("PETROBRAS");

  // Agrupamento de feristas por chapaRM / Colaborador (Relação N:N de postos)
  const feristasConsolidados = useMemo(() => {
    const map = new Map<
      string,
      {
        chapaRM: string;
        nome: string;
        unidade: string;
        postosVinculados: Array<{
          postoIdSGP: string;
          idReferencia?: string | number;
          postoBase?: number | string;
          tipoPosto?: string;
          funcao?: string;
          modalidade?: string;
        }>;
      }
    >();

    // Feristas do catálogo REV04
    (FERISTAS_REV04 || []).forEach((f) => {
      const chapa = f.chapaRM || f.colaborador;
      if (!chapa) return;

      const existente = map.get(chapa) || {
        chapaRM: f.chapaRM || chapa,
        nome: f.colaborador,
        unidade: f.unidade || "BASE NÃO INFORMADA",
        postosVinculados: [],
      };

      if (!existente.postosVinculados.some((p) => p.postoIdSGP === f.postoIdSGP)) {
        existente.postosVinculados.push({
          postoIdSGP: f.postoIdSGP,
          idReferencia: f.idReferenciaPosto,
          postoBase: f.postoBase,
          tipoPosto: f.tipoPosto,
          funcao: f.funcao,
          modalidade: f.modalidadeContratual,
        });
      }

      map.set(chapa, existente);
    });

    // Complementa com profissionais que atuam como ferista/reserva técnica
    profissionais.forEach((prof) => {
      if (
        prof.tipoColaborador === "FERISTA" ||
        prof.tipoColaborador === "RESERVA_TECNICA" ||
        prof.statusAlocacao === "FERISTA"
      ) {
        const chapa = prof.matricula;
        if (!map.has(chapa)) {
          map.set(chapa, {
            chapaRM: prof.matricula,
            nome: prof.nome,
            unidade: prof.unidadeBase || prof.unidade || "BASE NÃO INFORMADA",
            postosVinculados: prof.postosVinculados
              ? prof.postosVinculados.map((id: string) => ({ postoIdSGP: id }))
              : [],
          });
        }
      }
    });

    return Array.from(map.values());
  }, [profissionais]);

  // Lista de unidades únicas
  const listaUnidades = useMemo(() => {
    const set = new Set<string>();
    feristasConsolidados.forEach((f) => {
      if (f.unidade) set.add(f.unidade.trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [feristasConsolidados]);

  // Filtragem dos feristas
  const feristasFiltrados = useMemo(() => {
    return feristasConsolidados.filter((f) => {
      if (filtroUnidade !== "TODAS" && f.unidade.trim().toUpperCase() !== filtroUnidade) {
        return false;
      }
      if (busca.trim()) {
        const termo = busca.trim().toLowerCase();
        const matchNome = f.nome.toLowerCase().includes(termo);
        const matchChapa = f.chapaRM.toLowerCase().includes(termo);
        const matchPosto = f.postosVinculados.some(
          (p) =>
            p.postoIdSGP.toLowerCase().includes(termo) ||
            String(p.idReferencia || "").toLowerCase().includes(termo) ||
            (p.funcao || "").toLowerCase().includes(termo)
        );
        if (!matchNome && !matchChapa && !matchPosto) return false;
      }
      return true;
    });
  }, [feristasConsolidados, filtroUnidade, busca]);

  // Mapeamento de coberturas por substituto (chapa ou nome)
  const coberturasPorFerista = useMemo(() => {
    const map = new Map<string, CoberturaOperacional[]>();
    coberturas.forEach((cob) => {
      const chaveMatricula = cob.substitutoMatricula;
      const chaveNome = cob.substitutoNome?.toUpperCase();

      if (chaveMatricula) {
        const list = map.get(chaveMatricula) || [];
        list.push(cob);
        map.set(chaveMatricula, list);
      }
      if (chaveNome) {
        const list = map.get(chaveNome) || [];
        if (!map.has(chaveMatricula)) {
          list.push(cob);
          map.set(chaveNome, list);
        }
      }
    });
    return map;
  }, [coberturas]);

  return (
    <div className="space-y-6 max-w-full mx-auto">
      {/* 1. CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <Users className="w-6 h-6 text-blue-600" />
            <h1>Gestão de Feristas por Unidade</h1>
            <span className="text-xs bg-blue-100 text-blue-900 border border-blue-300 font-semibold px-2 py-0.5 rounded">
              Vínculo N:N • Contrato Petrobras
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Feristas não ocupam posição permanente no mapa. Atuam como cobertura operacional nos postos aos quais estão homologados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-2 rounded border border-slate-300 shadow-xs transition-colors cursor-pointer"
          >
            <CalendarCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Ver Mapa de Cobertura</span>
          </Link>
          {!ehFiscal && (
            <Link
              href="/coberturas"
              className="inline-flex items-center gap-1.5 bg-premier-900 hover:bg-premier-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Cobertura</span>
            </Link>
          )}
        </div>
      </div>

      {/* 2. CARDS DE RESUMO */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
            Total de Feristas Homologados
          </span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{feristasConsolidados.length}</div>
          <span className="text-[11px] text-slate-500 block mt-0.5">Contrato Petrobras</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-blue-200 bg-blue-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
            Unidades Atendidas
          </span>
          <div className="text-2xl font-bold text-blue-900 mt-1">{listaUnidades.length}</div>
          <span className="text-[11px] text-blue-600 block mt-0.5">Bases operacionais</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-emerald-200 bg-emerald-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider block">
            Total de Vínculos com Postos (N:N)
          </span>
          <div className="text-2xl font-bold text-emerald-900 mt-1">
            {feristasConsolidados.reduce((acc, f) => acc + f.postosVinculados.length, 0)}
          </div>
          <span className="text-[11px] text-emerald-600 block mt-0.5">Postos com cobertura homologada</span>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-purple-200 bg-purple-50/20 shadow-2xs">
          <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block">
            Coberturas Registradas
          </span>
          <div className="text-2xl font-bold text-purple-900 mt-1">{coberturas.length}</div>
          <span className="text-[11px] text-purple-600 block mt-0.5">Eventos operacionais no ciclo</span>
        </div>
      </div>

      {/* 3. FILTROS */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por nome, chapa ou posto..."
            className="w-full text-xs pl-8 pr-3 py-1.5 border border-slate-300 rounded-md outline-none focus:border-blue-500 bg-white"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600 text-xs cursor-pointer"
            >
              ×
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs text-slate-500 font-medium shrink-0">Unidade:</span>
          <select
            value={filtroUnidade}
            onChange={(e) => setFiltroUnidade(e.target.value)}
            className="w-full sm:w-auto text-xs border border-slate-300 rounded-md px-2.5 py-1.5 bg-white text-slate-700 outline-none"
          >
            <option value="TODAS">Todas as Unidades ({listaUnidades.length})</option>
            {listaUnidades.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          {(busca || filtroUnidade !== "TODAS") && (
            <button
              onClick={() => {
                setBusca("");
                setFiltroUnidade("TODAS");
              }}
              className="inline-flex items-center gap-1 text-[11px] text-rose-600 hover:text-rose-800 font-semibold cursor-pointer shrink-0 ml-1"
            >
              <FilterX className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* 4. LISTA DE FERISTAS E POSTOS VINCULADOS */}
      <div className="space-y-4">
        {feristasFiltrados.length === 0 ? (
          <div className="bg-white p-8 rounded-lg border border-slate-200 text-center text-slate-500">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <div className="font-semibold text-sm">Nenhum ferista encontrado com os filtros atuais.</div>
            <p className="text-xs text-slate-400 mt-1">Ajuste os filtros de busca ou selecione outra unidade.</p>
          </div>
        ) : (
          feristasFiltrados.map((ferista) => {
            const cobList =
              coberturasPorFerista.get(ferista.chapaRM) ||
              coberturasPorFerista.get(ferista.nome.toUpperCase()) ||
              [];

            return (
              <div
                key={ferista.chapaRM}
                className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden transition-all hover:border-slate-300"
              >
                {/* Linha Principal do Ferista */}
                <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-900 border border-blue-200 flex items-center justify-center font-bold text-xs shrink-0">
                      {ferista.nome
                        .split(" ")
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0])
                        .join("")}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{ferista.nome}</span>
                        <span className="font-mono text-xs text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                          Chapa {ferista.chapaRM}
                        </span>
                        <span className="text-[11px] font-semibold text-blue-800 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {ferista.unidade}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>Homologado em {ferista.postosVinculados.length} {ferista.postosVinculados.length === 1 ? "posto" : "postos"}</span>
                        <span>•</span>
                        <span>{cobList.length} {cobList.length === 1 ? "cobertura registrada" : "coberturas registradas"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setFeristaSelecionado(
                          feristaSelecionado === ferista.chapaRM ? null : ferista.chapaRM
                        )
                      }
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5 text-slate-500" />
                      <span>{feristaSelecionado === ferista.chapaRM ? "Ocultar Histórico" : "Ver Coberturas"}</span>
                    </button>
                    {!ehFiscal && (
                      <Link
                        href={`/coberturas?substituto=${encodeURIComponent(ferista.chapaRM)}`}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded bg-premier-900 hover:bg-premier-800 text-white transition-colors cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Nova Cobertura</span>
                      </Link>
                    )}
                  </div>
                </div>

                {/* Conteúdo: Postos Homologados (Vínculo N:N) */}
                <div className="p-3.5 space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                      Postos Vinculados (Homologação Operacional N:N)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {ferista.postosVinculados.map((pv) => {
                        const postoCompleto = postos.find(
                          (p) =>
                            p.idPosto === pv.postoIdSGP ||
                            p.idReferencia === pv.idReferencia ||
                            p.id === pv.postoIdSGP
                        );

                        return (
                          <div
                            key={pv.postoIdSGP}
                            className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start justify-between gap-2 text-xs"
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono font-bold text-blue-900 bg-blue-100/70 border border-blue-200 px-1.5 py-0.5 rounded text-[11px]">
                                  ID {pv.idReferencia || pv.postoBase || postoCompleto?.idReferencia || pv.postoIdSGP}
                                </span>
                                <span className="font-semibold text-slate-800 text-[11px] truncate max-w-[140px]" title={pv.funcao || postoCompleto?.funcao}>
                                  {pv.funcao || postoCompleto?.funcao || "Operacional"}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-1">
                                Regime: <strong>{pv.tipoPosto || postoCompleto?.tipoPostoId || "Turno/16h"}</strong>
                              </div>
                            </div>
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-medium shrink-0">
                              Homologado
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Histórico de Coberturas Expandido */}
                  {feristaSelecionado === ferista.chapaRM && (
                    <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 uppercase tracking-wider">
                        <History className="w-3.5 h-3.5 text-blue-600" />
                        <span>Histórico de Coberturas Realizadas ({cobList.length})</span>
                      </div>

                      {cobList.length === 0 ? (
                        <div className="p-4 bg-slate-50 rounded border border-slate-200 text-center text-slate-500 text-xs">
                          Nenhum evento de cobertura registrado para este ferista até o momento.
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                          {cobList.map((cob) => (
                            <div key={cob.id} className="p-2.5 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
                                    {cob.postoCodigo}
                                  </span>
                                  <span className="font-bold text-slate-800">
                                    Substituiu: {cob.titularNome || "Titular"} ({cob.titularMatricula || "-"})
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Motivo: <strong>{cob.justificativa || cob.tipoCobertura || "Cobertura Operacional"}</strong>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="font-medium text-slate-700 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                                  {cob.dataInicio.split("-").reverse().join("/")} até {cob.dataFim.split("-").reverse().join("/")}
                                </span>
                                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                                  {cob.status}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
