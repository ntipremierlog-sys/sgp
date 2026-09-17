"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Gestão de Modelos de Mapeamento de Arquivos de Ponto
 *
 * Configuração de colunas para RHID, exportações RM e outros layouts (.xlsx, .xls, .csv).
 * Minimização LGPD: Somente campos autorizados de telemetria.
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { carregarEstado } from "@/lib/dados/estado-operacional";
import {
  MapeamentoColunasPonto,
  MODELOS_PADRAO_PONTO,
  carregarModelosPonto,
  salvarModelosPonto,
} from "@/lib/importadores/planilha-ponto";

export default function ModelosPontoPage() {
  const router = useRouter();
  const [modelos, setModelos] = useState<MapeamentoColunasPonto[]>([]);
  const [modeloEdicao, setModeloEdicao] = useState<Partial<MapeamentoColunasPonto> | null>(null);
  const [sucessoMsg, setSucessoMsg] = useState("");

  useEffect(() => {
    const estado = carregarEstado();
    if (estado.perfilAtivo === "PETROBRAS_FISCAL") {
      router.replace("/acesso-negado");
      return;
    }
    const lista = carregarModelosPonto();
    setModelos(lista);
  }, [router]);

  function iniciarNovoModelo() {
    setModeloEdicao({
      id: `mod-${Date.now()}`,
      nomeModelo: "Novo Modelo RHID",
      colunaIdentificador: "CPF",
      tipoIdentificador: "CPF",
      colunaData: "DATA",
      formatoData: "DD/MM/YYYY",
      colunaHora: "HORA",
      formatoHora: "HH:MM",
      colunaNsr: "NSR",
      colunaEquipamento: "EQUIPAMENTO",
      separadorCsv: ";",
      codificacao: "UTF-8",
    });
  }

  function salvarModelo() {
    if (!modeloEdicao || !modeloEdicao.nomeModelo || !modeloEdicao.colunaIdentificador || !modeloEdicao.colunaData) {
      alert("Preencha todos os campos obrigatórios (Nome, Coluna Identificador e Coluna Data).");
      return;
    }

    const modFinal: MapeamentoColunasPonto = {
      id: modeloEdicao.id || `mod-${Date.now()}`,
      nomeModelo: modeloEdicao.nomeModelo,
      colunaIdentificador: modeloEdicao.colunaIdentificador,
      tipoIdentificador: modeloEdicao.tipoIdentificador || "CPF",
      colunaData: modeloEdicao.colunaData,
      formatoData: modeloEdicao.formatoData || "DD/MM/YYYY",
      colunaHora: modeloEdicao.colunaHora,
      formatoHora: modeloEdicao.formatoHora || "HH:MM",
      colunaNsr: modeloEdicao.colunaNsr,
      colunaEquipamento: modeloEdicao.colunaEquipamento,
      separadorCsv: modeloEdicao.separadorCsv || ";",
      codificacao: modeloEdicao.codificacao || "UTF-8",
      colunasMultiplasBatidas: modeloEdicao.colunasMultiplasBatidas,
      padrao: false,
    };

    const listaAtualizada = [...modelos.filter((m) => m.id !== modFinal.id), modFinal];
    setModelos(listaAtualizada);
    salvarModelosPonto(listaAtualizada);
    setModeloEdicao(null);
    setSucessoMsg("Modelo salvo com sucesso!");
    setTimeout(() => setSucessoMsg(""), 3500);
  }

  function excluirModelo(id: string) {
    if (confirm("Deseja realmente remover este modelo configurado?")) {
      const novaLista = modelos.filter((m) => m.id !== id);
      setModelos(novaLista);
      salvarModelosPonto(novaLista);
    }
  }

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Modelos de Arquivo de Ponto</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              Configuração RHID / RM
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Mapeamento dinâmico de cabeçalhos de planilhas (.xlsx, .xls, .csv) para identificação automática no upload.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={iniciarNovoModelo}
            className="px-4 py-2 text-xs font-semibold bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors shadow-sm"
          >
            + Cadastrar Novo Modelo
          </button>
        </div>
      </div>

      {sucessoMsg && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 rounded-md text-xs font-semibold">
          {sucessoMsg}
        </div>
      )}

      {/* Grid de Modelos Cadastrados */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {modelos.map((mod) => (
          <div key={mod.id} className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-foreground">{mod.nomeModelo}</h3>
                <span className="text-xs text-muted-foreground">
                  Identificador: {mod.colunaIdentificador} ({mod.tipoIdentificador})
                </span>
              </div>
              {mod.padrao && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  Padrão Sistema
                </span>
              )}
            </div>

            <div className="text-xs space-y-1.5 pt-2 border-t border-border">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coluna de Data:</span>
                <span className="font-mono font-medium">{mod.colunaData} ({mod.formatoData})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coluna de Hora:</span>
                <span className="font-mono font-medium">
                  {mod.colunasMultiplasBatidas
                    ? "Múltiplas (ENT1/SAI1...)"
                    : mod.colunaHora || "Mesma coluna"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">NSR / Equipamento:</span>
                <span className="font-mono font-medium">{mod.colunaNsr || "—"} / {mod.colunaEquipamento || "—"}</span>
              </div>
              {mod.separadorCsv && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Separador CSV / Codificação:</span>
                  <span className="font-mono font-medium">'{mod.separadorCsv}' / {mod.codificacao}</span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <button
                onClick={() => setModeloEdicao(mod)}
                className="px-2.5 py-1 text-xs font-medium rounded border border-input hover:bg-muted transition-colors"
              >
                Editar
              </button>
              {!mod.padrao && (
                <button
                  onClick={() => excluirModelo(mod.id)}
                  className="px-2.5 py-1 text-xs font-medium rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                >
                  Excluir
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal de Cadastro / Edição */}
      {modeloEdicao && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-foreground">Configurar Modelo de Arquivo de Ponto</h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">Nome do Modelo</label>
                <input
                  type="text"
                  value={modeloEdicao.nomeModelo || ""}
                  onChange={(e) => setModeloEdicao({ ...modeloEdicao, nomeModelo: e.target.value })}
                  placeholder="Ex: RHID - Exportação Padrão Postos"
                  className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Coluna de Identificação *</label>
                  <input
                    type="text"
                    value={modeloEdicao.colunaIdentificador || ""}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, colunaIdentificador: e.target.value })}
                    placeholder="Ex: CPF ou CHAPA"
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Tipo de Identificador</label>
                  <select
                    value={modeloEdicao.tipoIdentificador || "CPF"}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, tipoIdentificador: e.target.value as any })}
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  >
                    <option value="CPF">CPF (11 dígitos)</option>
                    <option value="CHAPA">Chapa RM (6 dígitos)</option>
                    <option value="PIS">PIS (11 dígitos)</option>
                    <option value="AUTO">Automático</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Coluna de Data *</label>
                  <input
                    type="text"
                    value={modeloEdicao.colunaData || ""}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, colunaData: e.target.value })}
                    placeholder="Ex: DATA"
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Formato de Data</label>
                  <select
                    value={modeloEdicao.formatoData || "DD/MM/YYYY"}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, formatoData: e.target.value as any })}
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  >
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="EXCEL_SERIAL">Data Serial do Excel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Coluna de Hora</label>
                  <input
                    type="text"
                    value={modeloEdicao.colunaHora || ""}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, colunaHora: e.target.value })}
                    placeholder="Ex: HORA"
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Formato de Hora</label>
                  <select
                    value={modeloEdicao.formatoHora || "HH:MM"}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, formatoHora: e.target.value as any })}
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md"
                  >
                    <option value="HH:MM">HH:MM</option>
                    <option value="HH:MM:SS">HH:MM:SS</option>
                    <option value="EXCEL_FRACTION">Fração Decimal do Excel</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">Coluna NSR (Opcional)</label>
                  <input
                    type="text"
                    value={modeloEdicao.colunaNsr || ""}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, colunaNsr: e.target.value })}
                    placeholder="Ex: NSR"
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-foreground mb-1">Equipamento / Origem (Opcional)</label>
                  <input
                    type="text"
                    value={modeloEdicao.colunaEquipamento || ""}
                    onChange={(e) => setModeloEdicao({ ...modeloEdicao, colunaEquipamento: e.target.value })}
                    placeholder="Ex: EQUIPAMENTO ou DESC. SECAO"
                    className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md font-mono"
                  />
                </div>
              </div>

              <div className="p-3 bg-muted/40 border border-border rounded-md text-[11px] text-muted-foreground leading-relaxed">
                <strong>Minimização LGPD:</strong> O sistema ignorará e não armazenará campos de fotos, geolocalização ou endereços IP contidos no arquivo original.
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setModeloEdicao(null)}
                className="px-4 py-2 text-xs font-medium rounded-md border border-input hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={salvarModelo}
                className="px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Salvar Modelo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
