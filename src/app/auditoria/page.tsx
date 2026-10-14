"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  History,
  Search,
  RotateCcw,
  Eye,
  FileDiff,
  X,
  AlertOctagon,
} from "lucide-react";
import { carregarEstado, LogAuditoriaOperacional } from "@/lib/dados/estado-operacional";

function formatarDataHora(ts: string): string {
  if (!ts) return "—";
  const match = ts.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (match) {
    const [, ano, mes, dia, hora, min] = match;
    return `${dia}/${mes}/${ano} ${hora}:${min}`;
  }
  return ts;
}

function rotuloAcao(acao: string): string {
  switch (acao) {
    case "ALTERAR_ESCALA":
      return "Alteração de Escala";
    case "ALTERAR_TITULAR":
      return "Alteração de Titular";
    case "CRIAR_COBERTURA":
      return "Nova Cobertura";
    case "EXCLUIR_COBERTURA":
      return "Exclusão de Cobertura";
    case "CRIAR_AUSENCIA":
      return "Lançamento de Ausência";
    case "EXCLUIR_AUSENCIA":
      return "Exclusão de Ausência";
    case "CONGELAR_COMPETENCIA":
      return "Fechamento de Competência";
    case "HOMOLOGAR_MEDICAO_PETROBRAS":
      return "Homologação Petrobras";
    case "REABRIR_COMPETENCIA":
      return "Reabertura de Competência";
    case "DESFAZER_LOTE_IMPORTACAO":
      return "Cancelamento de Lote";
    case "LIMPEZA_DADOS_DEMONSTRACAO":
      return "Limpeza de Demonstração";
    case "IMPORTACAO_FUNCIONARIOS_RM":
      return "Importação Funcionários RM";
    case "IMPORTACAO_CUBO_ABONO":
      return "Importação Abonos RM";
    case "IMPORTACAO_ALOCADOS_SIFAC":
      return "Importação Alocados";
    default:
      return acao.replace(/_/g, " ");
  }
}

function badgeAcao(acao: string): string {
  if (acao.includes("HOMOLOGAR") || acao.startsWith("CRIAR")) {
    return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
  if (acao.startsWith("ALTERAR") || acao.includes("ATUALIZAR")) {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }
  if (acao.startsWith("EXCLUIR") || acao.startsWith("CANCELAR") || acao.includes("DESFAZER")) {
    return "bg-rose-50 text-rose-700 border-rose-200";
  }
  if (acao.includes("CONGELAR") || acao.includes("REABRIR") || acao.includes("APONTAMENTO")) {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }
  return "bg-slate-100 text-slate-700 border-slate-200";
}

function rotuloPerfil(perfil: string): string {
  switch (perfil) {
    case "PREMIER_ADMIN":
      return "Administrador";
    case "PREMIER_RH":
      return "RH";
    case "PREMIER_SUPERVISOR":
      return "Preposto";
    case "PREMIER_GESTOR":
    case "PREMIER_GESTOR_CONTRATO":
      return "Gerente";
    case "PETROBRAS_FISCAL":
      return "Fiscal";
    case "PETROBRAS_GESTOR":
      return "Gestor";
    default:
      return perfil.replace("PREMIER_", "").replace("PETROBRAS_", "");
  }
}

function badgePerfil(perfil: string): string {
  if (perfil.startsWith("PETROBRAS")) {
    return "bg-emerald-50 text-emerald-800 border-emerald-200";
  }
  return "bg-blue-50 text-blue-800 border-blue-200";
}

function formatarJson(str?: string | null): string {
  if (!str) return "—";
  try {
    const obj = JSON.parse(str);
    return JSON.stringify(obj, null, 2);
  } catch {
    return str;
  }
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoriaOperacional[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("TODAS");
  const [filtroPerfil, setFiltroPerfil] = useState("TODOS");
  const [acessoBloqueado, setAcessoBloqueado] = useState(false);
  const [carregandoAuth, setCarregandoAuth] = useState(true);
  const [logModal, setLogModal] = useState<LogAuditoriaOperacional | null>(null);

  const carregarDados = () => {
    const estado = carregarEstado();
    setLogs(estado.logsAuditoria || []);
  };

  useEffect(() => {
    const verificarPermissao = async () => {
      try {
        const res = await fetch("/api/auth");
        if (res.ok) {
          const data = await res.json();
          if (data.autenticado && data.usuario) {
            if (data.usuario.perfil !== "PREMIER_ADMIN") {
              setAcessoBloqueado(true);
              setCarregandoAuth(false);
              return;
            }
          }
        }
      } catch {
        // fallback
      }

      const estado = carregarEstado();
      if (estado.perfilAtivo && estado.perfilAtivo !== "PREMIER_ADMIN") {
        setAcessoBloqueado(true);
      }
      setCarregandoAuth(false);
    };

    verificarPermissao();
    carregarDados();

    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const acoesDisponiveis = useMemo(() => {
    const setAcoes = new Set<string>();
    logs.forEach((l) => setAcoes.add(l.acao));
    return Array.from(setAcoes).sort();
  }, [logs]);

  const perfisDisponiveis = useMemo(() => {
    const setP = new Set<string>();
    logs.forEach((l) => setP.add(l.perfil));
    return Array.from(setP).sort();
  }, [logs]);

  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      const termo = busca.toLowerCase().trim();
      const matchTexto =
        !termo ||
        log.usuario.toLowerCase().includes(termo) ||
        log.acao.toLowerCase().includes(termo) ||
        rotuloAcao(log.acao).toLowerCase().includes(termo) ||
        log.entidade.toLowerCase().includes(termo) ||
        log.detalhes.toLowerCase().includes(termo) ||
        (log.registroId && log.registroId.toLowerCase().includes(termo));

      const matchAcao = filtroAcao === "TODAS" || log.acao === filtroAcao;
      const matchPerfil = filtroPerfil === "TODOS" || log.perfil === filtroPerfil;

      return matchTexto && matchAcao && matchPerfil;
    });
  }, [logs, busca, filtroAcao, filtroPerfil]);

  const temFiltroAtivo = busca !== "" || filtroAcao !== "TODAS" || filtroPerfil !== "TODOS";

  if (!carregandoAuth && acessoBloqueado) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="bg-white border border-rose-200 rounded-2xl shadow-sm p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-100">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Acesso Restrito à Auditoria
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            A trilha de auditoria é de acesso restrito ao perfil <strong>Administrador Premier</strong>.
          </p>
          <div className="pt-2">
            <Link
              href="/painel"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors inline-block"
            >
              Voltar ao Painel Geral
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Cabeçalho Limpo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg font-bold text-slate-800">Trilha de Auditoria</h1>
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full font-medium">
              {logsFiltrados.length} {logsFiltrados.length === 1 ? "registro" : "registros"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Histórico cronológico de ações, alterações de escala e registros realizados no sistema.
          </p>
        </div>
      </div>

      {/* Barra de Filtros Compacta */}
      <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
        {/* Campo de Busca */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por usuário, ação, detalhe ou código..."
            className="w-full pl-9 pr-8 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {busca && (
            <button
              onClick={() => setBusca("")}
              className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              title="Limpar busca"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros em linha */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro por Ação */}
          <select
            value={filtroAcao}
            onChange={(e) => setFiltroAcao(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="TODAS">Todas as Ações</option>
            {acoesDisponiveis.map((a) => (
              <option key={a} value={a}>
                {rotuloAcao(a)}
              </option>
            ))}
          </select>

          {/* Filtro por Perfil */}
          <select
            value={filtroPerfil}
            onChange={(e) => setFiltroPerfil(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700 font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="TODOS">Todos os Perfis</option>
            {perfisDisponiveis.map((p) => (
              <option key={p} value={p}>
                {rotuloPerfil(p)}
              </option>
            ))}
          </select>

          {/* Limpar filtros */}
          {temFiltroAtivo && (
            <button
              onClick={() => {
                setBusca("");
                setFiltroAcao("TODAS");
                setFiltroPerfil("TODOS");
              }}
              className="h-8 px-2.5 inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Limpar todos os filtros"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpar</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabela de Logs Essencial */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Data / Hora</th>
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Usuário</th>
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Ação Realizada</th>
                <th className="py-2.5 px-4 font-semibold">Detalhes</th>
                <th className="py-2.5 px-4 font-semibold text-center whitespace-nowrap">Alterações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    Nenhum registro encontrado para os filtros informados.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const temDiff = Boolean(log.valorAnterior || log.valorNovo);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Data / Hora */}
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap font-mono text-[11px]">
                        {formatarDataHora(log.timestamp)}
                      </td>

                      {/* Usuário e Perfil */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">{log.usuario}</div>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.2 rounded border ${badgePerfil(
                            log.perfil
                          )}`}
                        >
                          {rotuloPerfil(log.perfil)}
                        </span>
                      </td>

                      {/* Ação */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badgeAcao(
                            log.acao
                          )}`}
                        >
                          {rotuloAcao(log.acao)}
                        </span>
                      </td>

                      {/* Detalhes */}
                      <td className="py-3 px-4 text-slate-700 max-w-md">
                        <div className="line-clamp-2 leading-relaxed" title={log.detalhes}>
                          {log.detalhes}
                        </div>
                        {log.entidade && (
                          <span className="text-[10px] text-slate-400 block mt-0.5">
                            {log.entidade} {log.registroId ? `• ${log.registroId}` : ""}
                          </span>
                        )}
                      </td>

                      {/* Botão de Ver Alterações */}
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        {temDiff ? (
                          <button
                            onClick={() => setLogModal(log)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200/70 transition-colors cursor-pointer"
                            title="Visualizar valores anteriores e novos"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Alterações</span>
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs font-mono">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhes / Alterações */}
      {logModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 overflow-hidden space-y-0">
            {/* Cabeçalho do Modal */}
            <div className="bg-slate-50 px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileDiff className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-800">
                  {rotuloAcao(logModal.acao)}
                </h3>
              </div>
              <button
                onClick={() => setLogModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto text-xs">
              {/* Metadados rápidos */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50/80 rounded-xl border border-slate-200 text-slate-600">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Usuário</span>
                  <span className="font-semibold text-slate-800">{logModal.usuario}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Perfil</span>
                  <span className="font-medium text-slate-700">{rotuloPerfil(logModal.perfil)}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold block">Data / Hora</span>
                  <span className="font-mono text-slate-700">{formatarDataHora(logModal.timestamp)}</span>
                </div>
              </div>

              {/* Descrição */}
              <div>
                <span className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Descrição da Ação:
                </span>
                <p className="text-slate-700 bg-white p-3 rounded-xl border border-slate-200 leading-relaxed">
                  {logModal.detalhes}
                </p>
              </div>

              {/* Comparativo de Valores Anterior e Novo */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <div className="font-semibold text-rose-800 mb-1 flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Valor Anterior:
                  </div>
                  <pre className="bg-rose-50/40 text-rose-950 p-3 rounded-xl border border-rose-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-56 leading-relaxed">
                    {formatarJson(logModal.valorAnterior)}
                  </pre>
                </div>

                <div>
                  <div className="font-semibold text-emerald-800 mb-1 flex items-center gap-1.5 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Valor Novo / Atual:
                  </div>
                  <pre className="bg-emerald-50/40 text-emerald-950 p-3 rounded-xl border border-emerald-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-56 leading-relaxed">
                    {formatarJson(logModal.valorNovo)}
                  </pre>
                </div>
              </div>

              {/* Informações técnicas discretas de rodapé */}
              {(logModal.ip || logModal.registroId) && (
                <div className="pt-2 text-[11px] text-slate-400 font-mono flex items-center justify-between border-t border-slate-100">
                  {logModal.registroId && <span>Registro ID: {logModal.registroId}</span>}
                  {logModal.ip && <span>IP de Origem: {logModal.ip}</span>}
                </div>
              )}
            </div>

            {/* Rodapé do Modal */}
            <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setLogModal(null)}
                className="h-8 px-4 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}