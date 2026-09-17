"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Gestão de Pendências Operacionais de Ponto
 *
 * Tratamento de inconsistências: marcações incompletas, faltas sem abono, escalas não confirmadas.
 * Status: Aberta | Verificada | Corrigida na origem (com registro de observação e autor).
 */

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  carregarEstado,
  obterPendenciasPonto,
  atualizarStatusPendenciaPonto,
  obterDataReferenciaPonto,
  registrarLogAuditoria,
} from "@/lib/dados/estado-operacional";
import { PendenciaPontoItem } from "@/lib/dados/ponto-tipos";

export default function PendenciasPontoPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [pendencias, setPendencias] = useState<PendenciaPontoItem[]>([]);
  const [perfilAtivo, setPerfilAtivo] = useState("PREMIER_ADMIN");
  const [filtroTipo, setFiltroTipo] = useState("TODOS");
  const [filtroStatus, setFiltroStatus] = useState("TODOS");
  const [busca, setBusca] = useState("");

  // Modal de tratamento
  const [itemSelecionado, setItemSelecionado] = useState<PendenciaPontoItem | null>(null);
  const [novoStatus, setNovoStatus] = useState<"ABERTA" | "VERIFICADA" | "CORRIGIDA_ORIGEM">("VERIFICADA");
  const [observacaoTexto, setObservacaoTexto] = useState("");

  useEffect(() => {
    const estado = carregarEstado();
    setPerfilAtivo(estado.perfilAtivo || "PREMIER_ADMIN");

    // Bloqueio Petrobras Fiscal
    if (estado.perfilAtivo === "PETROBRAS_FISCAL") {
      router.replace("/acesso-negado");
      return;
    }

    registrarLogAuditoria(
      "ACESSO_TELA_PENDENCIAS_PONTO",
      "PendenciasPonto",
      "Visualização de pendências de marcação e faltas sem abono.",
      estado.perfilAtivo || "PREMIER_ADMIN"
    );

    const lista = obterPendenciasPonto();
    setPendencias(lista);
    setCarregando(false);
  }, [router]);

  const pendenciasFiltradas = useMemo(() => {
    return pendencias.filter((p) => {
      if (filtroTipo !== "TODOS" && p.tipo !== filtroTipo) return false;
      if (filtroStatus !== "TODOS" && p.status !== filtroStatus) return false;
      if (busca.trim()) {
        const termo = busca.toLowerCase();
        const nomeMatch = (p.nome || "").toLowerCase().includes(termo);
        const chapaMatch = (p.chapa || "").includes(termo);
        const detalhesMatch = p.detalhes.toLowerCase().includes(termo);
        if (!nomeMatch && !chapaMatch && !detalhesMatch) return false;
      }
      return true;
    });
  }, [pendencias, filtroTipo, filtroStatus, busca]);

  function abrirTratamento(item: PendenciaPontoItem) {
    setItemSelecionado(item);
    setNovoStatus(item.status);
    setObservacaoTexto(item.observacao || "");
  }

  function salvarTratamento() {
    if (!itemSelecionado) return;
    const ok = atualizarStatusPendenciaPonto(
      itemSelecionado.id,
      novoStatus,
      observacaoTexto,
      perfilAtivo === "PREMIER_ADMIN" ? "Administrador Premier" : "Gestor da Base"
    );

    if (ok) {
      setPendencias((prev) =>
        prev.map((p) =>
          p.id === itemSelecionado.id
            ? {
                ...p,
                status: novoStatus,
                observacao: observacaoTexto,
                atualizadoPor: perfilAtivo === "PREMIER_ADMIN" ? "Administrador Premier" : "Gestor da Base",
                atualizadoEm: new Date().toISOString().replace("T", " ").substring(0, 16),
              }
            : p
        )
      );
      setItemSelecionado(null);
    }
  }

  function getBadgeTipo(tipo: PendenciaPontoItem["tipo"]) {
    switch (tipo) {
      case "MARCACAO_INCOMPLETA":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Marcação Incompleta</span>;
      case "FALTA_SEM_ABONO":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Falta sem Abono</span>;
      case "ESCALA_NAO_CONFIRMADA":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Escala não confirmada</span>;
      case "COLABORADOR_NAO_ENCONTRADO":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-800">Não Encontrado</span>;
    }
  }

  function getBadgeStatus(status: PendenciaPontoItem["status"]) {
    switch (status) {
      case "ABERTA":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Aberta</span>;
      case "VERIFICADA":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-700">Verificada</span>;
      case "CORRIGIDA_ORIGEM":
        return <span className="px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-700">Corrigida na Origem</span>;
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Pendências Operacionais de Ponto</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Acompanhamento de batidas ímpares, ausências sem justificativa e escalas que demandam ação com o sistema de ponto.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/presenca-diaria")}
            className="px-3 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 transition-colors"
          >
            Ver Presença Diária
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
              Tipo de Pendência
            </label>
            <select
              value={filtroTipo}
              onChange={(e) => setFiltroTipo(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
            >
              <option value="TODOS">Todos os Tipos</option>
              <option value="MARCACAO_INCOMPLETA">Marcação Incompleta (Ímpar)</option>
              <option value="FALTA_SEM_ABONO">Falta sem Abono</option>
              <option value="ESCALA_NAO_CONFIRMADA">Escala não confirmada</option>
              <option value="COLABORADOR_NAO_ENCONTRADO">Colaborador não encontrado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
              Status do Tratamento
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="ABERTA">Aberta</option>
              <option value="VERIFICADA">Verificada</option>
              <option value="CORRIGIDA_ORIGEM">Corrigida na Origem</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
              Buscar Colaborador / Chapa
            </label>
            <input
              type="text"
              placeholder="Digite nome, chapa ou detalhe..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Pendências */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Lista de Inconsistências Registradas ({pendenciasFiltradas.length} pendências)
          </h2>
          <span className="text-xs text-muted-foreground">
            Ajustes devem ser realizados no sistema de origem (RHID/RM) e reimportados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3">Data Ref.</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Colaborador / Base</th>
                <th className="px-4 py-3">Detalhes da Ocorrência</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Observações de Gestão</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-xs">
              {pendenciasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhuma pendência encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                pendenciasFiltradas.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold font-mono text-foreground">
                      {item.dataReferencia.split("-").reverse().join("/")}
                    </td>
                    <td className="px-4 py-3">{getBadgeTipo(item.tipo)}</td>
                    <td className="px-4 py-3 font-medium">
                      <div className="text-foreground">{item.nome || "Não identificado"}</div>
                      <div className="text-muted-foreground font-mono text-[11px]">
                        {item.chapa ? `Chapa: ${item.chapa}` : ""} • {item.baseId || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[300px] text-muted-foreground leading-relaxed">
                      {item.detalhes}
                    </td>
                    <td className="px-4 py-3">{getBadgeStatus(item.status)}</td>
                    <td className="px-4 py-3 max-w-[220px]">
                      {item.observacao ? (
                        <div>
                          <div className="text-foreground font-medium truncate">{item.observacao}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {item.atualizadoPor} em {item.atualizadoEm}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground italic">Sem observação</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => abrirTratamento(item)}
                        className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                      >
                        Tratar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Tratamento de Pendência */}
      {itemSelecionado && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-foreground">Tratar Pendência de Ponto</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {itemSelecionado.nome} (Chapa: {itemSelecionado.chapa}) • {itemSelecionado.dataReferencia}
              </p>
            </div>

            <div className="p-3 bg-muted/40 rounded-md border border-border text-xs text-muted-foreground">
              {itemSelecionado.detalhes}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Status da Verificação
                </label>
                <select
                  value={novoStatus}
                  onChange={(e) => setNovoStatus(e.target.value as any)}
                  className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md font-medium"
                >
                  <option value="ABERTA">Aberta (Em análise)</option>
                  <option value="VERIFICADA">Verificada (Notificado gestor/RH)</option>
                  <option value="CORRIGIDA_ORIGEM">Corrigida na Origem (Pronto para reimportação)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Observação de Gestão
                </label>
                <textarea
                  rows={3}
                  value={observacaoTexto}
                  onChange={(e) => setObservacaoTexto(e.target.value)}
                  placeholder="Ex: Solicitado ajuste manual ao gestor da base no RHID; atestado médico em validação..."
                  className="w-full p-2 text-sm bg-background border border-input rounded-md"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setItemSelecionado(null)}
                className="px-4 py-2 text-xs font-medium rounded-md border border-input hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarTratamento}
                className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Salvar Tratamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
