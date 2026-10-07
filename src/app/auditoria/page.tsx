"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  History,
  Search,
  ShieldCheck,
  Database,
  UserCheck,
  ArrowRight,
  X,
  Server,
  Lock,
  FileSpreadsheet,
  AlertOctagon,
  Eye,
  FileDiff,
  CheckCircle2,
} from "lucide-react";
import { carregarEstado, LogAuditoriaOperacional } from "@/lib/dados/estado-operacional";

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

  if (!carregandoAuth && acessoBloqueado) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white border border-rose-300 rounded-xl shadow-lg p-8 text-center space-y-4">
          <div className="w-16 h-16 bg-rose-100 text-rose-700 rounded-full flex items-center justify-center mx-auto">
            <AlertOctagon className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Acesso Restrito — Trilha de Auditoria
          </h1>
          <p className="text-sm text-slate-600 max-w-lg mx-auto leading-relaxed">
            A visualização detalhada da trilha de auditoria completa com valores anteriores e novos
            é de acesso exclusivo ao perfil <strong>Administrador Premier</strong>. Usuários com
            perfil Fiscal Petrobras acessam apenas relatórios de conformidade e cumprimento contratual.
          </p>
          <div className="pt-4 flex items-center justify-center gap-3">
            <Link
              href="/painel"
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
            >
              Voltar ao Painel Geral
            </Link>
            <Link
              href="/relatorios"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border border-slate-300 transition-colors"
            >
              Ir para Relatórios
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const logsFiltrados = logs.filter((log) => {
    const matchTexto =
      log.usuario.toLowerCase().includes(busca.toLowerCase()) ||
      log.acao.toLowerCase().includes(busca.toLowerCase()) ||
      log.entidade.toLowerCase().includes(busca.toLowerCase()) ||
      log.detalhes.toLowerCase().includes(busca.toLowerCase()) ||
      log.ip.includes(busca) ||
      (log.registroId && log.registroId.toLowerCase().includes(busca.toLowerCase()));

    const matchAcao = filtroAcao === "TODAS" || log.acao === filtroAcao;
    const matchPerfil = filtroPerfil === "TODOS" || log.perfil === filtroPerfil;

    return matchTexto && matchAcao && matchPerfil;
  });

  const getAcaoBadge = (acao: string) => {
    if (acao === "CONGELAR_COMPETENCIA") {
      return "bg-indigo-50 text-indigo-900 border-indigo-300 font-bold";
    }
    if (acao === "HOMOLOGAR_MEDICAO_PETROBRAS") {
      return "bg-emerald-100 text-emerald-900 border-emerald-400 font-bold";
    }
    if (acao === "REABRIR_COMPETENCIA") {
      return "bg-rose-50 text-rose-900 border-rose-300 font-bold";
    }
    if (acao.startsWith("CRIAR")) {
      return "bg-emerald-50 text-emerald-800 border-emerald-200";
    }
    if (acao.startsWith("ALTERAR") || acao.includes("ATUALIZAR")) {
      return "bg-blue-50 text-blue-800 border-blue-200 font-semibold";
    }
    if (acao.startsWith("EXCLUIR") || acao.startsWith("CANCELAR")) {
      return "bg-rose-50 text-rose-800 border-rose-200 font-semibold";
    }
    if (acao.includes("APONTAMENTO")) {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  const formatarJson = (str?: string | null) => {
    if (!str) return "—";
    try {
      const obj = JSON.parse(str);
      return JSON.stringify(obj, null, 2);
    } catch {
      return str;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <History className="w-6 h-6 text-blue-700" />
            <h1>Trilha de Auditoria Geral</h1>
            <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded border border-blue-200">
              Exclusivo Administrador Premier
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Registro cronológico imutável de quem criou, alterou ou excluiu posição, titular, escala,
            cobertura e ausência, com data/hora e valores anteriores e novos.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/relatorios"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded border border-slate-300 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
            <span>Relatórios Oficiais</span>
          </Link>
          <Link
            href="/mapa-ocupacao"
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded border border-slate-300 transition-colors"
          >
            <span>Mapa de Cobertura</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Banner de Garantia Técnica */}
      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-700">
          <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <span className="font-bold text-slate-900">Princípio da Rastreabilidade e Responsabilidade (LGPD, Art. 6º, X):</span>{" "}
            Cada registro contém o carimbo de data/hora UTC-3, identificação do usuário autenticado, endereço IP de origem, ação executada e diff estruturado do valor anterior e novo.
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1 text-[11px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
          <Database className="w-3 h-3 text-blue-600" />
          <span>Tabela log_auditoria</span>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>TOTAL DE EVENTOS</span>
            <History className="w-4 h-4 text-slate-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{logs.length}</div>
          <div className="mt-1 text-[11px] text-slate-500">Eventos auditados</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>ALTERAÇÕES DE ESCALA</span>
            <FileDiff className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700 tabular-nums">
            {logs.filter((l) => l.acao.includes("ESCALA")).length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Ciclos e horários atualizados</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>COBERTURAS E AUSÊNCIAS</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
            {logs.filter((l) => l.acao.includes("COBERTURA") || l.acao.includes("AUSENCIA")).length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Operações rastreadas</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>INTEGRIDADE EM REPOUSO</span>
            <Server className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-800">Neon sa-east-1</div>
          <div className="mt-1 text-[11px] text-slate-500">São Paulo, Brasil</div>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 flex-1 min-w-[240px] border border-slate-300 rounded px-2.5 py-1.5 bg-slate-50">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Filtrar por usuário, ação, entidade, registro ou IP..."
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
            <span className="font-semibold text-slate-600">Ação:</span>
            <select
              value={filtroAcao}
              onChange={(e) => setFiltroAcao(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none"
            >
              <option value="TODAS">Todas as Ações</option>
              <option value="ALTERAR_ESCALA">ALTERAR_ESCALA</option>
              <option value="ALTERAR_TITULAR">ALTERAR_TITULAR</option>
              <option value="CRIAR_POSICAO">CRIAR_POSICAO</option>
              <option value="ALTERAR_POSICAO">ALTERAR_POSICAO</option>
              <option value="EXCLUIR_POSICAO">EXCLUIR_POSICAO</option>
              <option value="CRIAR_COBERTURA">CRIAR_COBERTURA</option>
              <option value="ALTERAR_COBERTURA">ALTERAR_COBERTURA</option>
              <option value="EXCLUIR_COBERTURA">EXCLUIR_COBERTURA</option>
              <option value="CRIAR_AUSENCIA">CRIAR_AUSENCIA</option>
              <option value="ALTERAR_AUSENCIA">ALTERAR_AUSENCIA</option>
              <option value="EXCLUIR_AUSENCIA">EXCLUIR_AUSENCIA</option>
              <option value="CONGELAR_COMPETENCIA">CONGELAR_COMPETENCIA</option>
              <option value="HOMOLOGAR_MEDICAO_PETROBRAS">HOMOLOGAR_MEDICAO_PETROBRAS</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-slate-600">Perfil:</span>
            <select
              value={filtroPerfil}
              onChange={(e) => setFiltroPerfil(e.target.value)}
              className="border border-slate-300 rounded px-2 py-1.5 bg-white text-slate-800 text-xs font-medium outline-none"
            >
              <option value="TODOS">Todos os Perfis</option>
              <option value="PREMIER_ADMIN">PREMIER_ADMIN</option>
              <option value="PREMIER_GESTOR">PREMIER_GESTOR</option>
              <option value="PREMIER_SUPERVISOR">PREMIER_SUPERVISOR</option>
              <option value="PETROBRAS_FISCAL">PETROBRAS_FISCAL</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Logs */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="py-2.5 px-3 font-bold">Data e Hora (UTC-3)</th>
                <th className="py-2.5 px-3 font-bold">Usuário / Ator</th>
                <th className="py-2.5 px-3 font-bold">Perfil</th>
                <th className="py-2.5 px-3 font-bold">Ação Executada</th>
                <th className="py-2.5 px-3 font-bold">Entidade / Registro</th>
                <th className="py-2.5 px-3 font-bold">Detalhes da Transação</th>
                <th className="py-2.5 px-3 font-bold text-center">Valor Ant. / Novo</th>
                <th className="py-2.5 px-3 font-bold text-center">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500 font-sans text-xs">
                    Nenhum registro de auditoria corresponde aos filtros informados.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const temDiff = Boolean(log.valorAnterior || log.valorNovo);

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {log.timestamp}
                      </td>
                      <td className="py-3 px-3 font-sans font-semibold text-slate-900 whitespace-nowrap">
                        {log.usuario}
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            log.perfil.startsWith("PETROBRAS")
                              ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                              : "bg-blue-50 text-blue-800 border-blue-300"
                          }`}
                        >
                          {log.perfil}
                        </span>
                      </td>
                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getAcaoBadge(log.acao)}`}>
                          {log.acao}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-800 font-semibold whitespace-nowrap font-sans">
                        <div>{log.entidade}</div>
                        {log.registroId && (
                          <span className="text-[10px] text-slate-400 font-mono block">
                            ID: {log.registroId}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 font-sans text-slate-700 max-w-sm">
                        <div className="line-clamp-2 leading-relaxed" title={log.detalhes}>
                          {log.detalhes}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-center whitespace-nowrap">
                        {temDiff ? (
                          <button
                            onClick={() => setLogModal(log)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-sans font-semibold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                          >
                            <Eye className="w-3 h-3" />
                            Ver Diff
                          </button>
                        ) : (
                          <span className="text-slate-400 font-sans text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center text-slate-500 whitespace-nowrap">
                        {log.ip}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Detalhamento / Diff */}
      {logModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-slate-300 overflow-hidden">
            <div className="bg-slate-900 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FileDiff className="w-5 h-5 text-blue-400" />
                <h3 className="text-sm font-bold">
                  Trilha de Auditoria — Rastreabilidade de Alteração
                </h3>
              </div>
              <button
                onClick={() => setLogModal(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
              <div className="grid grid-cols-2 gap-4 pb-3 border-b border-slate-200">
                <div>
                  <span className="text-slate-500 font-medium block">Ação:</span>
                  <span className="font-bold text-slate-900">{logModal.acao}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Data e Hora:</span>
                  <span className="font-mono text-slate-800">{logModal.timestamp}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Usuário Responsável:</span>
                  <span className="font-semibold text-slate-800">{logModal.usuario}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block">Entidade / Registro:</span>
                  <span className="font-mono text-slate-800">{logModal.entidade}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-500 font-medium block mb-1">Descrição da Operação:</span>
                <p className="text-slate-800 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed font-sans">
                  {logModal.detalhes}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <div className="font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-rose-500" />
                    Valor Anterior:
                  </div>
                  <pre className="bg-rose-50/50 text-rose-950 p-3 rounded border border-rose-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-60">
                    {formatarJson(logModal.valorAnterior)}
                  </pre>
                </div>

                <div>
                  <div className="font-bold text-emerald-800 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Valor Novo / Atual:
                  </div>
                  <pre className="bg-emerald-50/50 text-emerald-950 p-3 rounded border border-emerald-200 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap max-h-60">
                    {formatarJson(logModal.valorNovo)}
                  </pre>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  onClick={() => setLogModal(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded font-medium text-xs transition-colors"
                >
                  Fechar Visualização
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
