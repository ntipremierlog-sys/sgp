"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Search, AlertOctagon, X } from "lucide-react";
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
      return "Alteração de escala";
    case "ALTERAR_TITULAR":
      return "Alteração de titular";
    case "CRIAR_COBERTURA":
      return "Nova cobertura";
    case "EXCLUIR_COBERTURA":
      return "Exclusão de cobertura";
    case "CRIAR_AUSENCIA":
      return "Lançamento de ausência";
    case "EXCLUIR_AUSENCIA":
      return "Exclusão de ausência";
    case "CONGELAR_COMPETENCIA":
      return "Fechamento de competência";
    case "HOMOLOGAR_MEDICAO_PETROBRAS":
      return "Homologação Petrobras";
    case "REABRIR_COMPETENCIA":
      return "Reabertura de competência";
    case "DESFAZER_LOTE_IMPORTACAO":
      return "Cancelamento de lote";
    case "LIMPEZA_DADOS_DEMONSTRACAO":
      return "Limpeza de demonstração";
    case "IMPORTACAO_FUNCIONARIOS_RM":
      return "Importação funcionários RM";
    case "IMPORTACAO_CUBO_ABONO":
      return "Importação abonos RM";
    case "IMPORTACAO_ALOCADOS_SIFAC":
      return "Importação alocados";
    case "CRIAR_POSICAO":
      return "Criação de posição";
    case "ALTERAR_POSICAO":
      return "Alteração de posição";
    case "EXCLUIR_POSICAO":
      return "Exclusão de posição";
    case "CRIAR_PROFISSIONAL":
      return "Cadastro de profissional";
    case "APONTAMENTO_NOVO":
      return "Novo apontamento";
    case "APONTAMENTO_RESPOSTA":
      return "Resposta de apontamento";
    default: {
      const s = acao.replace(/_/g, " ").toLowerCase();
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
  }
}

function extrairReferencia(log: LogAuditoriaOperacional): string {
  const d = log.detalhes || "";

  // Titular alterado para Mayara Fiuza Louzada (Matrícula: 035928)
  const mTitular = d.match(/Titular alterado para (.+?)(?: \(Matr[íi]cula: ([^)]+)\))?(?:\.|$)/i);
  if (mTitular) {
    const nome = mTitular[1].trim();
    const mat = mTitular[2] ? ` · ${mTitular[2].trim()}` : "";
    return `${nome}${mat}`;
  }

  // Designado Fulano para posto PST-REFAP-204
  const mCob = d.match(/Designado (.+?) para posto ([^\s·]+)/i);
  if (mCob) {
    return `${mCob[1].trim()} · ${mCob[2].trim()}`;
  }

  // Férias / Ausência para Fulano
  const mAus = d.match(/(?:Férias|Atestado|Falta|Licença|Ausência) para (.+?)(?: —|$)/i);
  if (mAus) {
    return mAus[1].trim();
  }

  // Cadastro do profissional Fulano
  const mProf = d.match(/Cadastro do profissional (.+?)$/i);
  if (mProf) {
    return mProf[1].trim();
  }

  // Cadastro do posto Operador - PST-01
  const mPosto = d.match(/posto (.+?) - ([^\s]+)$/i);
  if (mPosto) {
    return `${mPosto[1].trim()} · ${mPosto[2].trim()}`;
  }

  // Buscar em JSON de valorNovo ou valorAnterior
  for (const raw of [log.valorNovo, log.valorAnterior]) {
    if (raw && typeof raw === "string" && raw.startsWith("{")) {
      try {
        const obj = JSON.parse(raw);
        const nome = obj.nome || obj.substitutoNome || obj.profissionalNome || obj.titularNome;
        const cod = obj.matricula || obj.chapa || obj.postoCodigo || obj.codigoPosto || obj.itemPpu;
        if (nome && cod) return `${nome} · ${cod}`;
        if (nome) return nome;
        if (cod && obj.funcao) return `${cod} · ${obj.funcao}`;
      } catch {}
    }
  }

  // Entidade com código entre parênteses: Posição (POS-01) ou Posto (PST-01)
  const mEnt = log.entidade?.match(/\(([^)]+)\)/);
  if (mEnt && log.registroId && mEnt[1] !== log.registroId) {
    return `${mEnt[1]} · ${log.registroId}`;
  }
  if (mEnt) {
    return mEnt[1];
  }

  if (log.registroId && log.entidade) {
    return `${log.entidade} · ${log.registroId}`;
  }

  return log.registroId || log.entidade || "—";
}

function resumirValor(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "string") {
    if (val.startsWith("{")) {
      try {
        const obj = JSON.parse(val);
        if (obj.nome && obj.matricula) return `${obj.nome} (${obj.matricula})`;
        if (obj.nome) return obj.nome;
        if (obj.substitutoNome) return obj.substitutoNome;
        if (obj.horario || obj.escala || obj.grupo) return obj.horario || obj.escala || obj.grupo;
        if (obj.status) return obj.status;
        const vals = Object.values(obj).filter((v) => typeof v === "string" || typeof v === "number");
        if (vals.length > 0) return String(vals.slice(0, 2).join(" · "));
      } catch {}
    }
    return val;
  }
  return String(val);
}

function extrairAlteracao(log: LogAuditoriaOperacional): string {
  const ant = log.valorAnterior ? resumirValor(log.valorAnterior) : "";
  const nvo = log.valorNovo ? resumirValor(log.valorNovo) : "";

  if (ant && nvo) {
    return `${ant} → ${nvo}`;
  }
  if (ant && !nvo) {
    return `${ant} → —`;
  }
  if (!ant && nvo) {
    return `— → ${nvo}`;
  }
  return "";
}

function filtrarPorPeriodo(timestamp: string, periodo: string): boolean {
  if (periodo === "TODOS" || !periodo) return true;
  if (!timestamp) return false;

  const dataLog = new Date(timestamp.replace(" ", "T"));
  if (isNaN(dataLog.getTime())) return true;

  const agora = new Date();
  const hojeInicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  if (periodo === "HOJE") {
    return dataLog >= hojeInicio;
  }
  if (periodo === "7_DIAS") {
    const seteDiasAtras = new Date(hojeInicio);
    seteDiasAtras.setDate(seteDiasAtras.getDate() - 7);
    return dataLog >= seteDiasAtras;
  }
  if (periodo === "30_DIAS") {
    const trintaDiasAtras = new Date(hojeInicio);
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
    return dataLog >= trintaDiasAtras;
  }
  if (periodo === "MES_ATUAL") {
    return dataLog.getFullYear() === agora.getFullYear() && dataLog.getMonth() === agora.getMonth();
  }
  return true;
}

export default function AuditoriaPage() {
  const [logs, setLogs] = useState<LogAuditoriaOperacional[]>([]);
  const [busca, setBusca] = useState("");
  const [filtroPeriodo, setFiltroPeriodo] = useState("TODOS");
  const [filtroUsuario, setFiltroUsuario] = useState("TODOS");
  const [filtroAcao, setFiltroAcao] = useState("TODAS");
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

  const usuariosDisponiveis = useMemo(() => {
    const setU = new Set<string>();
    logs.forEach((l) => {
      if (l.usuario) setU.add(l.usuario);
    });
    return Array.from(setU).sort();
  }, [logs]);

  const acoesDisponiveis = useMemo(() => {
    const setA = new Set<string>();
    logs.forEach((l) => {
      if (l.acao) setA.add(l.acao);
    });
    return Array.from(setA).sort();
  }, [logs]);

  const logsFiltrados = useMemo(() => {
    return logs.filter((log) => {
      const termo = busca.toLowerCase().trim();
      const ref = extrairReferencia(log).toLowerCase();
      const alt = extrairAlteracao(log).toLowerCase();
      const acaoNome = rotuloAcao(log.acao).toLowerCase();

      const matchTexto =
        !termo ||
        log.usuario.toLowerCase().includes(termo) ||
        log.acao.toLowerCase().includes(termo) ||
        acaoNome.includes(termo) ||
        ref.includes(termo) ||
        alt.includes(termo) ||
        log.detalhes.toLowerCase().includes(termo) ||
        (log.registroId && log.registroId.toLowerCase().includes(termo));

      const matchPeriodo = filtrarPorPeriodo(log.timestamp, filtroPeriodo);
      const matchUsuario = filtroUsuario === "TODOS" || log.usuario === filtroUsuario;
      const matchAcao = filtroAcao === "TODAS" || log.acao === filtroAcao;

      return matchTexto && matchPeriodo && matchUsuario && matchAcao;
    });
  }, [logs, busca, filtroPeriodo, filtroUsuario, filtroAcao]);

  const temFiltroAtivo =
    busca !== "" || filtroPeriodo !== "TODOS" || filtroUsuario !== "TODOS" || filtroAcao !== "TODAS";

  const limparFiltros = () => {
    setBusca("");
    setFiltroPeriodo("TODOS");
    setFiltroUsuario("TODOS");
    setFiltroAcao("TODAS");
  };

  if (!carregandoAuth && acessoBloqueado) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs p-8 text-center space-y-4">
          <div className="w-12 h-12 bg-slate-100 text-slate-600 rounded-full flex items-center justify-center mx-auto border border-slate-200">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <h1 className="text-base font-bold text-slate-800">
            Acesso Restrito à Auditoria
          </h1>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            A trilha de auditoria é de acesso restrito ao perfil <strong>Administrador Premier</strong>.
          </p>
          <div className="pt-2">
            <Link
              href="/painel"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors inline-block"
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
      {/* 1. Cabeçalho: apenas o título "Auditoria", sem ícone, sem subtítulo e sem linha divisória */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Auditoria</h1>
      </div>

      {/* 2. Filtros em uma linha, sem caixa em volta: Período, Usuário, Ação e busca */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Período */}
        <select
          value={filtroPeriodo}
          onChange={(e) => setFiltroPeriodo(e.target.value)}
          className="h-8 px-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 font-normal cursor-pointer focus:outline-none focus:border-slate-400"
        >
          <option value="TODOS">Todo o período</option>
          <option value="HOJE">Hoje</option>
          <option value="7_DIAS">Últimos 7 dias</option>
          <option value="30_DIAS">Últimos 30 dias</option>
          <option value="MES_ATUAL">Mês atual</option>
        </select>

        {/* Usuário */}
        <select
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
          className="h-8 px-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 font-normal cursor-pointer focus:outline-none focus:border-slate-400 max-w-[200px]"
        >
          <option value="TODOS">Todos os usuários</option>
          {usuariosDisponiveis.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>

        {/* Ação */}
        <select
          value={filtroAcao}
          onChange={(e) => setFiltroAcao(e.target.value)}
          className="h-8 px-2.5 text-xs rounded-md border border-slate-300 bg-white text-slate-700 font-normal cursor-pointer focus:outline-none focus:border-slate-400 max-w-[220px]"
        >
          <option value="TODAS">Todas as ações</option>
          {acoesDisponiveis.map((a) => (
            <option key={a} value={a}>
              {rotuloAcao(a)}
            </option>
          ))}
        </select>

        {/* Busca */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded-md border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
          />
        </div>

        {temFiltroAtivo && (
          <button
            onClick={limparFiltros}
            className="h-8 px-2 text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
          >
            Limpar
          </button>
        )}
      </div>

      {/* 3 e 4. Tabela: Data/Hora | Usuário | Ação | Referência | Alteração (uma linha por registro, fundo branco, bordas finas, sem cores) */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Data/Hora</th>
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Usuário</th>
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Ação</th>
                <th className="py-2.5 px-4 font-semibold whitespace-nowrap">Referência</th>
                <th className="py-2.5 px-4 font-semibold">Alteração</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {logsFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400 text-xs">
                    Nenhum registro encontrado.
                  </td>
                </tr>
              ) : (
                logsFiltrados.map((log) => {
                  const ref = extrairReferencia(log);
                  const alt = extrairAlteracao(log);
                  const temDiff = Boolean(log.valorAnterior || log.valorNovo);

                  return (
                    <tr
                      key={log.id}
                      onClick={() => temDiff && setLogModal(log)}
                      className={`border-b border-slate-100 hover:bg-slate-50/60 transition-colors ${
                        temDiff ? "cursor-pointer" : ""
                      }`}
                    >
                      {/* Data/Hora: "14/10/2026 15:06", fonte normal */}
                      <td className="py-2.5 px-4 text-slate-600 whitespace-nowrap font-normal">
                        {formatarDataHora(log.timestamp)}
                      </td>

                      {/* Usuário: só o nome, sem o perfil abaixo */}
                      <td className="py-2.5 px-4 text-slate-900 whitespace-nowrap font-normal">
                        {log.usuario}
                      </td>

                      {/* Ação: texto normal, sem caixa alta */}
                      <td className="py-2.5 px-4 text-slate-800 whitespace-nowrap font-normal">
                        {rotuloAcao(log.acao)}
                      </td>

                      {/* Referência: colaborador ou posto em uma linha (ex.: "Mayara Fiuza Louzada · 035928") */}
                      <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap font-normal">
                        {ref}
                      </td>

                      {/* Alteração: "antes → depois" quando houver; vazio quando não houver */}
                      <td className="py-2.5 px-4 text-slate-600 font-normal">
                        {alt || ""}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rodapé com contagem e aviso legal LGPD */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500 px-1 pt-2 border-t border-slate-100">
        <div>
          {logsFiltrados.length} {logsFiltrados.length === 1 ? "registro" : "registros"}
        </div>
        <div className="text-[11px] text-slate-400">
          Aviso de Finalidade (LGPD): Contrato ICJ 5900.0129796.25.2 · Lei nº 13.709/2018 · PostgreSQL Neon (aws-sa-east-1 · São Paulo) · Vercel (gru1)
        </div>
      </div>

      {/* Modal sóbrio de inspeção detalhada caso o usuário clique em um registro com alterações */}
      {logModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-xl w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">
                {rotuloAcao(logModal.acao)}
              </h3>
              <button
                onClick={() => setLogModal(null)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600 pb-2 border-b border-slate-100">
                <div>
                  <span className="text-slate-400 block text-[11px]">Usuário:</span>
                  <span className="text-slate-800 font-medium">{logModal.usuario}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px]">Data/Hora:</span>
                  <span className="text-slate-800">{formatarDataHora(logModal.timestamp)}</span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block text-[11px] mb-0.5">Referência:</span>
                <span className="text-slate-800 font-medium">{extrairReferencia(logModal)}</span>
              </div>

              {logModal.detalhes && (
                <div>
                  <span className="text-slate-400 block text-[11px] mb-0.5">Detalhes:</span>
                  <p className="text-slate-700 bg-slate-50 p-2.5 rounded border border-slate-200 leading-relaxed">
                    {logModal.detalhes}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <span className="text-slate-500 font-medium block mb-1">Antes:</span>
                  <pre className="bg-slate-50 text-slate-700 p-2.5 rounded border border-slate-200 text-[11px] overflow-x-auto whitespace-pre-wrap max-h-48">
                    {logModal.valorAnterior || "—"}
                  </pre>
                </div>
                <div>
                  <span className="text-slate-500 font-medium block mb-1">Depois:</span>
                  <pre className="bg-slate-50 text-slate-700 p-2.5 rounded border border-slate-200 text-[11px] overflow-x-auto whitespace-pre-wrap max-h-48">
                    {logModal.valorNovo || "—"}
                  </pre>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-5 py-2.5 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setLogModal(null)}
                className="h-7 px-3 rounded border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs cursor-pointer"
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