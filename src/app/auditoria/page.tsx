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
} from "lucide-react";
import { carregarEstado, LogAuditoriaOperacional } from "@/lib/dados/estado-operacional";

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoriaOperacional[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroAcao, setFiltroAcao] = useState("TODAS");
  const [filtroPerfil, setFiltroPerfil] = useState("TODOS");

  const carregarDados = () => {
    const estado = carregarEstado();
    setLogs(estado.logsAuditoria);
  };

  useEffect(() => {
    carregarDados();
    const handleAtualizacao = () => carregarDados();
    window.addEventListener("sgp-dados-atualizados", handleAtualizacao);
    return () => window.removeEventListener("sgp-dados-atualizados", handleAtualizacao);
  }, []);

  const logsFiltrados = logs.filter((log) => {
    const matchTexto =
      log.usuario.toLowerCase().includes(busca.toLowerCase()) ||
      log.acao.toLowerCase().includes(busca.toLowerCase()) ||
      log.entidade.toLowerCase().includes(busca.toLowerCase()) ||
      log.detalhes.toLowerCase().includes(busca.toLowerCase()) ||
      log.ip.includes(busca);

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
    if (acao.startsWith("RESPONDER")) {
      return "bg-blue-50 text-blue-800 border-blue-200";
    }
    if (acao.includes("APONTAMENTO")) {
      return "bg-amber-50 text-amber-800 border-amber-200";
    }
    if (acao.includes("PERFIL")) {
      return "bg-purple-50 text-purple-800 border-purple-200";
    }
    return "bg-slate-100 text-slate-700 border-slate-200";
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <History className="w-6 h-6 text-slate-700" />
            <h1>Trilha de Auditoria Imutável</h1>
            <span className="text-xs bg-slate-200 text-slate-800 font-semibold px-2 py-0.5 rounded border border-slate-300">
              PostgreSQL Neon em São Paulo
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Registro cronológico contínuo e à prova de adulteração de todas as operações, cadastros, ocorrências, coberturas e manifestações da Fiscalização Petrobras.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/fechamento"
            className="inline-flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 text-xs font-semibold px-3 py-2 rounded border border-indigo-200 transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Fechamento Mensal</span>
          </Link>
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
            <span>Mapa de Ocupação</span>
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
            Cada registro contém o carimbo de data/hora UTC-3, identificação do usuário autenticado, endereço IP de origem, ação executada e diff da entidade manipulada.
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
            <span>AÇÕES PETROBRAS</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-700 tabular-nums">
            {logs.filter((l) => l.perfil.startsWith("PETROBRAS")).length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Notificações e consultas</div>
        </div>

        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
            <span>AÇÕES PREMIER</span>
            <ShieldCheck className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-blue-700 tabular-nums">
            {logs.filter((l) => l.perfil.startsWith("PREMIER")).length}
          </div>
          <div className="mt-1 text-[11px] text-slate-500">Cadastros e coberturas</div>
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
            placeholder="Filtrar por usuário, ação, entidade ou IP..."
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
              <option value="CONGELAR_COMPETENCIA">CONGELAR_COMPETENCIA (Fechamento)</option>
              <option value="HOMOLOGAR_MEDICAO_PETROBRAS">HOMOLOGAR_MEDICAO_PETROBRAS (Atesto)</option>
              <option value="REABRIR_COMPETENCIA">REABRIR_COMPETENCIA (Emergencial)</option>
              <option value="CRIAR_POSTO">CRIAR_POSTO</option>
              <option value="CRIAR_PROFISSIONAL">CRIAR_PROFISSIONAL</option>
              <option value="REGISTRAR_OCORRENCIA">REGISTRAR_OCORRENCIA</option>
              <option value="CRIAR_COBERTURA">CRIAR_COBERTURA</option>
              <option value="REGISTRAR_APONTAMENTO">REGISTRAR_APONTAMENTO</option>
              <option value="RESPONDER_APONTAMENTO">RESPONDER_APONTAMENTO</option>
              <option value="ALTERAR_PERFIL">ALTERAR_PERFIL</option>
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
              <option value="PETROBRAS_FISCAL">PETROBRAS_FISCAL</option>
              <option value="PREMIER_ADMIN">PREMIER_ADMIN</option>
              <option value="PREMIER_GESTOR_CONTRATO">PREMIER_GESTOR_CONTRATO</option>
              <option value="PREMIER_SUPERVISOR">PREMIER_SUPERVISOR</option>
              <option value="PREMIER_RH">PREMIER_RH</option>
              <option value="SISTEMA">SISTEMA</option>
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
                <th className="py-2.5 px-3 font-bold">Perfil RBAC</th>
                <th className="py-2.5 px-3 font-bold">Ação Executada</th>
                <th className="py-2.5 px-3 font-bold">Entidade</th>
                <th className="py-2.5 px-3 font-bold">Detalhes da Transação</th>
                <th className="py-2.5 px-3 font-bold text-center">IP de Origem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans text-xs">
                    Nenhum registro de auditoria corresponde aos filtros informados.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => (
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
                            : log.perfil.startsWith("PREMIER")
                            ? "bg-blue-50 text-blue-800 border-blue-300"
                            : "bg-slate-100 text-slate-700 border-slate-300"
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
                    <td className="py-3 px-3 text-slate-800 font-semibold whitespace-nowrap">
                      {log.entidade}
                    </td>
                    <td className="py-3 px-3 font-sans text-slate-700 max-w-sm">
                      <div className="line-clamp-2 leading-relaxed" title={log.detalhes}>
                        {log.detalhes}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center text-slate-500 whitespace-nowrap">
                      {log.ip}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
