"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  RotateCcw,
  Download,
  AlertTriangle,
  CheckCircle2,
  Database,
  FileText,
  Trash2,
  Users,
  Briefcase,
  Layers,
  ArrowRight,
  RefreshCw,
  FileCheck2,
  X,
} from "lucide-react";
import {
  carregarEstado,
  salvarEstado,
  EstadoOperacionalCompleto,
} from "@/lib/dados/estado-operacional";
import {
  simularLimpezaDadosDemo,
  executarLimpezaDadosDemo,
  RelatorioLimpezaDados,
} from "@/lib/dados/limpeza-dados-demo";

interface ItemBackup {
  nomeArquivo: string;
  tamanhoFormatado: string;
  dataModificacao: string;
  motivo?: string;
  autor?: string;
}

interface AbaLimpezaDadosProps {
  usuarioNome: string;
  onNotificar: (msg: string, erro?: boolean) => void;
}

export function AbaLimpezaDados({ usuarioNome, onNotificar }: AbaLimpezaDadosProps) {
  const [estado, setEstado] = useState<EstadoOperacionalCompleto>(carregarEstado);
  const [relatorio, setRelatorio] = useState<RelatorioLimpezaDados | null>(null);
  const [tipoVisualizacao, setTipoVisualizacao] = useState<"SIMULACAO" | "EXECUCAO" | null>(null);
  const [backups, setBackups] = useState<ItemBackup[]>([]);
  const [carregando, setCarregando] = useState(false);

  // Modais de confirmação
  const [modalConfirmarLimpeza, setModalConfirmarLimpeza] = useState(false);
  const [modalConfirmarRestauracao, setModalConfirmarRestauracao] = useState<string | null>(null);

  // Carrega estado e lista de backups
  const carregarDados = async () => {
    setEstado(carregarEstado());
    try {
      const res = await fetch("/api/admin/limpeza");
      if (res.ok) {
        const data = await res.json();
        if (data.backups) {
          setBackups(data.backups);
        }
      }
    } catch {
      // offline / fallback
    }
  };

  useEffect(() => {
    carregarDados();

    const sincronizar = () => {
      setEstado(carregarEstado());
    };
    window.addEventListener("sgp-dados-atualizados", sincronizar);
    return () => {
      window.removeEventListener("sgp-dados-atualizados", sincronizar);
    };
  }, []);

  // Simulação prévia
  const handleSimular = () => {
    try {
      const sim = simularLimpezaDadosDemo(usuarioNome);
      setRelatorio(sim);
      setTipoVisualizacao("SIMULACAO");
      onNotificar("Simulação concluída com sucesso! Nenhum dado foi alterado.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao simular limpeza";
      onNotificar(msg, true);
    }
  };

  // Execução da limpeza
  const handleExecutarLimpeza = async () => {
    setCarregando(true);
    setModalConfirmarLimpeza(false);

    try {
      // 1. Tenta executar via API para gravar o backup no disco do servidor
      const res = await fetch("/api/admin/limpeza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "EXECUTAR" }),
      });

      let relatorioFinal: RelatorioLimpezaDados;

      if (res.ok) {
        const dados = await res.json();
        relatorioFinal = dados.relatorio;
        if (dados.backups) {
          setBackups(dados.backups);
        }
      } else {
        // Fallback local caso a API não responda
        relatorioFinal = executarLimpezaDadosDemo(usuarioNome);
      }

      // 2. Atualiza estado em tela e localStorage do navegador
      salvarEstado({
        postos: relatorioFinal.snapshotBackup.estadoOperacional.postos.map((p) => ({
          ...p,
          titularMatricula: undefined,
          titularNome: undefined,
        })),
        profissionais: [],
        ocorrencias: [],
        coberturas: [],
        coberturasExcluidasIds: [],
        apontamentos: [],
        ajustesManuaisDia: [],
        marcacoesPonto: [],
        diasFolgaRm: [],
        pendenciasPonto: [],
        dataReferenciaPonto: undefined,
      });

      setRelatorio(relatorioFinal);
      setTipoVisualizacao("EXECUCAO");
      setEstado(carregarEstado());

      // 3. Dispara download automático do JSON de backup para garantia do usuário
      baixarJsonNavegador(
        relatorioFinal.snapshotBackup,
        `backup_limpeza_sgp_${new Date().toISOString().substring(0, 10)}.json`
      );

      onNotificar("Limpeza geral de dados fictícios executada com sucesso! Backup JSON gerado.");
      carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao executar limpeza";
      onNotificar(msg, true);
    } finally {
      setCarregando(false);
    }
  };

  // Restauração de backup
  const handleRestaurarBackup = async (nomeArquivo: string) => {
    setCarregando(true);
    setModalConfirmarRestauracao(null);

    try {
      const res = await fetch("/api/admin/limpeza", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao: "RESTAURAR", nomeArquivo }),
      });

      if (!res.ok) {
        throw new Error("Falha ao restaurar backup no servidor.");
      }

      const dados = await res.json();
      if (dados.snapshot?.estadoOperacional) {
        salvarEstado(dados.snapshot.estadoOperacional);
      }

      setEstado(carregarEstado());
      setRelatorio(null);
      setTipoVisualizacao(null);
      onNotificar(`Backup "${nomeArquivo}" restaurado com sucesso!`);
      carregarDados();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao restaurar backup";
      onNotificar(msg, true);
    } finally {
      setCarregando(false);
    }
  };

  // Helper para download direto via navegador
  const baixarJsonNavegador = (obj: any, nomeArquivo: string) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(obj, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", nomeArquivo);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const totalVagos = estado.postos.filter((p) => !p.titularMatricula).length;
  const totalOcupados = estado.postos.filter((p) => !!p.titularMatricula).length;

  return (
    <div className="space-y-6">
      {/* Banner de Apresentação e Diretrizes Contratuais */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 rounded-xl p-5 text-white shadow-sm border border-slate-700/50">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="w-3.5 h-3.5" />
              MOMENTO 1 — Governança e Transição para Produção
            </div>
            <h2 className="text-lg font-bold tracking-tight text-white flex items-center gap-2">
              Limpeza Geral de Dados de Demonstração & Backup
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Remove em lote todos os dados fictícios operacionais (colaboradores simulados, coberturas e ocorrências de teste),
              <strong className="text-white font-semibold"> preservando estritamente os 15 postos contratuais do Anexo 1-A</strong> (tornando-os vagos para vínculo de profissionais oficiais),
              os usuários/perfis do sistema e toda a trilha imutável de auditoria.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={handleSimular}
              disabled={carregando}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${carregando ? "animate-spin" : ""}`} />
              <span>Simular Limpeza</span>
            </button>

            <button
              onClick={() => setModalConfirmarLimpeza(true)}
              disabled={carregando}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Executar Limpeza Geral</span>
            </button>
          </div>
        </div>
      </div>

      {/* Cards de Diagnóstico do Estado Atual */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Postos do Anexo 1-A */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Postos Anexo 1-A</span>
            <Briefcase className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{estado.postos.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            <span className="text-emerald-700 font-semibold">{totalVagos} vagos</span> • {totalOcupados} ocupados
          </div>
        </div>

        {/* Colaboradores */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Colaboradores</span>
            <Users className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{estado.profissionais.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">
            {estado.profissionais.length === 0 ? (
              <span className="text-emerald-700 font-medium">✓ Base 100% limpa</span>
            ) : (
              <span className="text-amber-700 font-medium">{estado.profissionais.length} cadastros na base</span>
            )}
          </div>
        </div>

        {/* Ocorrências */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Ocorrências</span>
            <FileText className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{estado.ocorrencias.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Atestados e faltas</div>
        </div>

        {/* Coberturas */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Coberturas</span>
            <Layers className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{estado.coberturas.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Substituições ativas</div>
        </div>

        {/* Apontamentos Petrobras */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Apontamentos</span>
            <ShieldAlert className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{estado.apontamentos.length}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Formalizações Petrobras</div>
        </div>
      </div>

      {/* Relatório de Simulação ou Execução */}
      {relatorio && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50/70">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-md uppercase tracking-wider ${
                    tipoVisualizacao === "EXECUCAO"
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                      : "bg-blue-100 text-blue-800 border border-blue-300"
                  }`}
                >
                  {tipoVisualizacao === "EXECUCAO" ? "Execução Concluída" : "Relatório de Simulação Prévia"}
                </span>
                <span className="text-xs text-slate-500">
                  {new Date(relatorio.timestamp).toLocaleString("pt-BR")} • por {relatorio.executadoPor}
                </span>
              </div>
              <h3 className="text-sm font-bold text-slate-900 mt-1">
                Demonstrativo Detalhado por Tabela e Entidade Operacional
              </h3>
            </div>

            <div className="flex items-center gap-3 text-xs">
              <div className="text-right">
                <span className="text-slate-500 block text-[11px]">Total afetados:</span>
                <span className="font-bold text-slate-900">
                  {relatorio.totalRegistrosOperacionaisRemovidos} registros
                </span>
              </div>
              <div className="text-right border-l pl-3 border-slate-200">
                <span className="text-slate-500 block text-[11px]">Postos preservados:</span>
                <span className="font-bold text-emerald-700">
                  {relatorio.postosAnexo1APreservados} postos (Anexo 1-A)
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Tabela / Entidade</th>
                  <th className="py-2.5 px-4">Descrição das Ações</th>
                  <th className="py-2.5 px-4 text-center">Registros Afetados</th>
                  <th className="py-2.5 px-4 text-center">Status Contratual</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {relatorio.tabelasAfetadas.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                      {item.tabela}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {item.descricao}
                    </td>
                    <td className="py-2.5 px-4 text-center font-bold text-slate-800">
                      {item.registrosRemovidos}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                          item.status === "PRESERVADO"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-800 border border-amber-200"
                        }`}
                      >
                        {item.status === "PRESERVADO" ? (
                          <>
                            <ShieldCheck className="w-3 h-3 text-emerald-600" />
                            PRESERVADO
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3 h-3 text-amber-600" />
                            LIMPO
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Histórico de Backups Físicos em Disco */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Arquivos de Backup em Disco (`backups/`)
            </h3>
            <span className="px-2 py-0.2 bg-slate-200 text-slate-700 text-[11px] rounded-full font-semibold">
              {backups.length}
            </span>
          </div>

          <button
            onClick={carregarDados}
            className="text-xs text-slate-600 hover:text-slate-900 flex items-center gap-1 font-medium cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Atualizar lista</span>
          </button>
        </div>

        {backups.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            Nenhum backup encontrado na pasta local `backups/`.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Arquivo JSON</th>
                  <th className="py-2.5 px-4">Motivo / Descrição</th>
                  <th className="py-2.5 px-4">Tamanho</th>
                  <th className="py-2.5 px-4">Data de Gravação</th>
                  <th className="py-2.5 px-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {backups.map((b) => (
                  <tr key={b.nomeArquivo} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-900 flex items-center gap-2">
                      <FileCheck2 className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{b.nomeArquivo}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {b.motivo || "Backup SGP"}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-700 font-medium">
                      {b.tamanhoFormatado}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600">
                      {b.dataModificacao}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <a
                          href={`/api/admin/limpeza?download=${encodeURIComponent(b.nomeArquivo)}`}
                          download={b.nomeArquivo}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:text-slate-950 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors"
                          title="Baixar arquivo JSON"
                        >
                          <Download className="w-3 h-3" />
                          <span>Baixar</span>
                        </a>

                        <button
                          onClick={() => setModalConfirmarRestauracao(b.nomeArquivo)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 rounded-md transition-colors cursor-pointer"
                          title="Restaurar este backup"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restaurar</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Limpeza Efetiva */}
      {modalConfirmarLimpeza && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirmar Limpeza Geral de Dados Fictícios?
                </h3>
                <p className="text-xs text-slate-600 mt-1">
                  Esta ação executará as regras do <strong>MOMENTO 1</strong> de transição operacional:
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs space-y-2 text-slate-700">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Backup Automático:</strong> Um snapshot completo do estado atual será gravado em arquivo JSON no disco (`backups/`) e baixado no seu navegador.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Preservação dos Postos:</strong> Todos os 15 postos contratuais do Anexo 1-A permanecerão cadastrados, com suas jornadas e escalas, passando ao status <strong>VAGO</strong>.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <Trash2 className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Remoção Fictícia:</strong> Todos os colaboradores, vínculos fictícios, ocorrências, coberturas e apontamentos simulados serão zerados.
                </span>
              </div>
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Auditoria Imutável:</strong> A ação será registrada na trilha de auditoria do sistema em nome de <em>{usuarioNome}</em>.
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalConfirmarLimpeza(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecutarLimpeza}
                disabled={carregando}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Confirmar e Executar Limpeza</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Restauração */}
      {modalConfirmarRestauracao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-md w-full p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Restaurar Backup Selecionado?
                </h3>
                <p className="text-xs text-slate-600 mt-1 font-mono break-all">
                  {modalConfirmarRestauracao}
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600">
              O estado operacional atual do sistema será substituído integralmente pelos dados gravados neste snapshot de backup.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalConfirmarRestauracao(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleRestaurarBackup(modalConfirmarRestauracao)}
                disabled={carregando}
                className="inline-flex items-center gap-2 px-4 py-1.5 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-sm transition-all cursor-pointer disabled:opacity-50"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Confirmar Restauração</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
