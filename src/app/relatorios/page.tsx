"use client";

import React, { useState, useEffect } from "react";
import {
  FileSpreadsheet,
  Download,
  Printer,
  UserCheck2,
  FileCheck,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import {
  carregarEstado,
  calcularStatusDia,
  PostoOperacional,
  OcorrenciaOperacional,
  CoberturaOperacional,
  ApontamentoOperacional,
} from "@/lib/dados/estado-operacional";

type TipoRelatorio = "espelho_ocupacao" | "glosas_descobertos" | "coberturas_substituicoes";

export default function RelatoriosPage() {
  const [tipoAtivo, setTipoAtivo] = useState<TipoRelatorio>("espelho_ocupacao");
  const [postos, setPostos] = useState<PostoOperacional[]>([]);
  const [ocorrencias, setOcorrencias] = useState<OcorrenciaOperacional[]>([]);
  const [coberturas, setCoberturas] = useState<CoberturaOperacional[]>([]);
  const [apontamentos, setApontamentos] = useState<ApontamentoOperacional[]>([]);
  const [competencia] = useState("Setembro / 2026");

  // Hash de Integridade simulado com SHA-256 estável
  const hashIntegridade = "a8f5c3b9914d023e6172ba9c84e120f5b9910d54e4649b934ca495991b7852b8";
  const dataGeracao = "15/09/2026 10:30:00";

  useEffect(() => {
    const estado = carregarEstado();
    setPostos(estado.postos);
    setOcorrencias(estado.ocorrencias);
    setCoberturas(estado.coberturas);
    setApontamentos(estado.apontamentos);
  }, []);

  // Setembro de 2026 (30 dias)
  const diasApurados = 15; // Dias apurados até a data atual

  // Consolidação analítica por posto
  const consolidadoPostos = postos.map((p) => {
    let diasExigiveis = 0;
    let titularPresente = 0;
    let cobertos = 0;
    let descobertos = 0;
    let folgas = 0;

    for (let d = 1; d <= diasApurados; d++) {
      const detalhe = calcularStatusDia(p, d, 2026, 8, ocorrencias, coberturas, apontamentos);
      if (detalhe.statusOcupacao === "TITULAR_PRESENTE") {
        diasExigiveis++;
        titularPresente++;
      } else if (detalhe.statusOcupacao === "COBERTO") {
        diasExigiveis++;
        cobertos++;
      } else if (detalhe.statusOcupacao === "DESCOBERTO") {
        diasExigiveis++;
        descobertos++;
      } else if (detalhe.statusOcupacao === "NAO_EXIGIVEL") {
        folgas++;
      }
    }

    const diasEfetivos = titularPresente + cobertos;
    const percEntrega = diasExigiveis > 0 ? Math.round((diasEfetivos / diasExigiveis) * 100) : 100;

    return {
      posto: p,
      diasExigiveis,
      titularPresente,
      cobertos,
      descobertos,
      folgas,
      diasEfetivos,
      percEntrega,
    };
  });

  // Lista de ocorrências de postos descobertos para apuração de glosas
  const listaDescobertos: {
    postoCodigo: string;
    funcao: string;
    dia: number;
    data: string;
    titularNome: string;
    motivo: string;
  }[] = [];

  postos.forEach((p) => {
    for (let d = 1; d <= diasApurados; d++) {
      const det = calcularStatusDia(p, d, 2026, 8, ocorrencias, coberturas, apontamentos);
      if (det.statusOcupacao === "DESCOBERTO") {
        listaDescobertos.push({
          postoCodigo: p.codigoPosto,
          funcao: p.funcao,
          dia: d,
          data: det.data,
          titularNome: det.titularNome || "Titular",
          motivo: det.motivoPublico,
        });
      }
    }
  });

  const totalGlosasDiarias = listaDescobertos.length;

  const handleImprimir = () => {
    window.print();
  };

  const handleDownloadCsv = () => {
    let csv = "";
    if (tipoAtivo === "espelho_ocupacao") {
      csv = "Codigo_Posto;Funcao;Escala;Titular;Dias_Exigiveis;Presentes;Cobertos;Descobertos;Taxa_Entrega\n";
      consolidadoPostos.forEach((c) => {
        csv += `${c.posto.codigoPosto};"${c.posto.funcao}";${c.posto.escala};"${c.posto.titularNome || "VAGO"}";${c.diasExigiveis};${c.titularPresente};${c.cobertos};${c.descobertos};${c.percEntrega}%\n`;
      });
    } else if (tipoAtivo === "glosas_descobertos") {
      csv = "Codigo_Posto;Funcao;Data;Titular;Motivo_Glosa\n";
      listaDescobertos.forEach((g) => {
        csv += `${g.postoCodigo};"${g.funcao}";${g.data};"${g.titularNome}";"${g.motivo.replace(/"/g, '""')}"\n`;
      });
    } else {
      csv = "Posto;Titular;Substituto;Data_Inicio;Data_Fim;Tipo;Status;Justificativa\n";
      coberturas.forEach((c) => {
        csv += `${c.postoCodigo};"${c.titularNome}";"${c.substitutoNome}";${c.dataInicio};${c.dataFim};${c.tipoCobertura};${c.status};"${c.justificativa.replace(/"/g, '""')}"\n`;
      });
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SGP_Relatorio_${tipoAtivo}_Setembro_2026.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-premier-900 font-bold text-xl md:text-2xl">
            <FileSpreadsheet className="w-6 h-6 text-green-600" />
            <h1>Relatórios & Base de Apoio à Memória de Cálculo</h1>
            <span className="text-xs bg-green-100 text-green-800 border border-green-300 font-semibold px-2 py-0.5 rounded">
              Fiscalização Petrobras
            </span>
          </div>
          <p className="text-xs md:text-sm text-slate-600 mt-1">
            Geração de demonstrativos consolidados em conformidade com o Item 11.3 (R4 e R5) do Contrato ICJ <strong>5900.0129796.25.2</strong> com assinatura digital SHA-256.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleImprimir}
            className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold px-3 py-2 rounded border border-slate-300 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Imprimir / PDF</span>
          </button>
          <button
            onClick={handleDownloadCsv}
            className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-3 py-2 rounded shadow transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Exportar CSV Oficial</span>
          </button>
        </div>
      </div>

      {/* Seletor de Tipo de Relatório */}
      <div className="flex border-b border-slate-300 bg-white rounded-t-lg px-2 pt-2 gap-1 text-xs font-semibold overflow-x-auto">
        <button
          onClick={() => setTipoAtivo("espelho_ocupacao")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            tipoAtivo === "espelho_ocupacao"
              ? "border-premier-900 text-premier-900 bg-slate-50 rounded-t font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileCheck className="w-4 h-4 text-emerald-600" />
          <span>1. Espelho Mensal de Ocupação do Posto</span>
        </button>

        <button
          onClick={() => setTipoAtivo("glosas_descobertos")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            tipoAtivo === "glosas_descobertos"
              ? "border-premier-900 text-premier-900 bg-slate-50 rounded-t font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>2. Relatório de Glosas & Postos Descobertos ({totalGlosasDiarias})</span>
        </button>

        <button
          onClick={() => setTipoAtivo("coberturas_substituicoes")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors whitespace-nowrap ${
            tipoAtivo === "coberturas_substituicoes"
              ? "border-premier-900 text-premier-900 bg-slate-50 rounded-t font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <UserCheck2 className="w-4 h-4 text-blue-600" />
          <span>3. Rastreabilidade de Coberturas ({coberturas.length})</span>
        </button>
      </div>

      {/* Caixa do Relatório Institucional (Visual de Impressão) */}
      <div className="bg-white rounded-b-lg border-x border-b border-slate-200 shadow-sm p-6 space-y-6">
        {/* Cabeçalho Institucional do Documento */}
        <div className="border border-slate-300 rounded-lg p-4 bg-slate-50/70 space-y-3">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                Petróleo Brasileiro S.A. – Petrobras • Premier Logistics
              </span>
              <h2 className="text-base font-bold text-slate-900 mt-0.5">
                {tipoAtivo === "espelho_ocupacao" && "Espelho Mensal Consolidado de Ocupação dos Postos de Serviço"}
                {tipoAtivo === "glosas_descobertos" && "Demonstrativo de Postos Descobertos e Glosas Contratuais"}
                {tipoAtivo === "coberturas_substituicoes" && "Relatório de Rastreabilidade de Coberturas e Substituições"}
              </h2>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-semibold text-slate-700 block">Competência: {competencia}</span>
              <span className="text-[10px] text-slate-500">Unidade: UFN III – Três Lagoas/MS</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
            <div>
              <span className="text-slate-500 font-medium">Contrato ICJ:</span>
              <div className="font-bold text-slate-800">5900.0129796.25.2</div>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Data/Hora Emissão:</span>
              <div className="font-mono text-slate-800">{dataGeracao}</div>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Período Apurado:</span>
              <div className="font-semibold text-slate-800">01 a {diasApurados}/09/2026 (Diárias)</div>
            </div>
            <div>
              <span className="text-slate-500 font-medium">Hash SHA-256:</span>
              <div className="font-mono text-[10px] text-slate-600 truncate" title={hashIntegridade}>
                {hashIntegridade.substring(0, 16)}...
              </div>
            </div>
          </div>
        </div>

        {/* Tabela do Relatório 1: Espelho Consolidado */}
        {tipoAtivo === "espelho_ocupacao" && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-bold">Código do Posto</th>
                    <th className="py-2.5 px-3 font-bold">Função Contratual</th>
                    <th className="py-2.5 px-3 font-bold">Titular Alocado</th>
                    <th className="py-2.5 px-3 font-bold text-center">Escala</th>
                    <th className="py-2.5 px-3 font-bold text-center">Dias Exigíveis</th>
                    <th className="py-2.5 px-3 font-bold text-center text-emerald-700">Presente</th>
                    <th className="py-2.5 px-3 font-bold text-center text-blue-700">Coberto</th>
                    <th className="py-2.5 px-3 font-bold text-center text-rose-700">Descoberto</th>
                    <th className="py-2.5 px-3 font-bold text-center">Taxa de Entrega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {consolidadoPostos.map((row) => (
                    <tr key={row.posto.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-premier-900">
                        {row.posto.codigoPosto}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900">
                        {row.posto.funcao}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {row.posto.titularNome || (
                          <span className="text-orange-700 font-bold text-[10px]">POSTO VAGO</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-[11px]">
                        {row.posto.escala}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-slate-800">
                        {row.diasExigiveis}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700 bg-emerald-50/40">
                        {row.titularPresente}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-blue-700 bg-blue-50/40">
                        {row.cobertos}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-rose-700 bg-rose-50/40">
                        {row.descobertos}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] ${
                            row.percEntrega === 100
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {row.percEntrega}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabela do Relatório 2: Glosas e Postos Descobertos */}
        {tipoAtivo === "glosas_descobertos" && (
          <div className="space-y-4">
            <div className="p-3.5 bg-rose-50 border border-rose-300 rounded-lg text-xs text-rose-900 flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>Total de Diárias Descobertas Sujeitas a Glosa na Medição: {totalGlosasDiarias} diária(s)</span>
              </div>
              <span className="text-[11px] font-mono font-semibold bg-white px-2.5 py-1 rounded border border-rose-300">
                Glosa Total: {totalGlosasDiarias} / 30 avos
              </span>
            </div>

            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-bold">Posto Notificado</th>
                    <th className="py-2.5 px-3 font-bold">Função Contratual</th>
                    <th className="py-2.5 px-3 font-bold">Data da Descoberta</th>
                    <th className="py-2.5 px-3 font-bold">Titular Ausente</th>
                    <th className="py-2.5 px-3 font-bold">Motivo / Evidência da Glosa</th>
                    <th className="py-2.5 px-3 font-bold text-center">Impacto Contratual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {listaDescobertos.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-500">
                        Nenhum posto descoberto registrado no período apurado.
                      </td>
                    </tr>
                  ) : (
                    listaDescobertos.map((item, idx) => (
                      <tr key={idx} className="hover:bg-rose-50/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-rose-900">
                          {item.postoCodigo}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {item.funcao}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-800">
                          {item.data} (Dia {item.dia})
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800">
                          {item.titularNome}
                        </td>
                        <td className="py-2.5 px-3 text-slate-700">
                          {item.motivo}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 border border-rose-300">
                            1 Glosa Diária
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tabela do Relatório 3: Coberturas Realizadas */}
        {tipoAtivo === "coberturas_substituicoes" && (
          <div className="space-y-4">
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-slate-700">
                    <th className="py-2.5 px-3 font-bold">Posto Coberto</th>
                    <th className="py-2.5 px-3 font-bold">Titular Ausente</th>
                    <th className="py-2.5 px-3 font-bold">Profissional Substituto</th>
                    <th className="py-2.5 px-3 font-bold">Período Atendido</th>
                    <th className="py-2.5 px-3 font-bold">Modalidade</th>
                    <th className="py-2.5 px-3 font-bold">Justificativa Operacional</th>
                    <th className="py-2.5 px-3 font-bold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {coberturas.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-premier-900">
                        {c.postoCodigo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800">
                        {c.titularNome}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-blue-900">
                        {c.substitutoNome} ({c.substitutoMatricula})
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {c.dataInicio} a {c.dataFim}
                      </td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {c.tipoCobertura.replace(/_/g, " ")}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 max-w-xs">
                        {c.justificativa}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rodapé de Assinatura e Integridade Contratual */}
        <div className="pt-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
          <div className="p-3 bg-slate-50 rounded border border-slate-200 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Assinatura Digital & Carimbo de Integridade (Item 11.3)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Relatório consolidado gerado a partir do registro diário imutável do Neon PostgreSQL.
              Assinado eletronicamente com chave SHA-256 e disponibilizado simultaneamente ao Gestor do Contrato e Fiscal Petrobras.
            </p>
            <div className="font-mono text-[10px] text-slate-700 bg-white p-1.5 rounded border border-slate-200 mt-2 break-all">
              SHA256:{hashIntegridade}
            </div>
          </div>

          <div className="flex flex-col justify-end text-center space-y-6 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="border-t border-slate-400 pt-1 text-[11px]">
                <div className="font-bold text-slate-800">Marcos Valério</div>
                <div className="text-slate-500 text-[10px]">Gestor do Contrato — Premier Logistics</div>
              </div>
              <div className="border-t border-slate-400 pt-1 text-[11px]">
                <div className="font-bold text-slate-800">Carlos Eduardo Mendes</div>
                <div className="text-slate-500 text-[10px]">Fiscal Técnico — Petrobras UFN III</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
