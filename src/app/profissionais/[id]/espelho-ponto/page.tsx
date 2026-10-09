"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Espelho Mensal de Presença e Marcações do Colaborador
 *
 * Restrição estrita de acesso: Somente perfis Premier (Admin, Gestor, RH).
 * Fiscal Petrobras não tem acesso a marcações individuais nem espelhos de colaboradores.
 */

import React, { useState, useEffect, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import {
  carregarEstado,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  obterDiasFolgaPonto,
  registrarLogAuditoria,
} from "@/lib/dados/estado-operacional";
import { apurarPresencaEPostos } from "@/lib/servicos/apuracao-presenca";
import { carregarHorariosInterpretados, carregarCiclosColaboradores } from "@/lib/servicos/interpretador-horarios";
import { ApuracaoPresencaDiaria, SituacaoPresencaDiaria } from "@/lib/dados/ponto-tipos";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function EspelhoPontoColaboradorPage({ params }: PageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const colaboradorId = resolvedParams.id;

  const [carregando, setCarregando] = useState(true);
  const [colaborador, setColaborador] = useState<any>(null);
  const [apuracoesMes, setApuracoesMes] = useState<ApuracaoPresencaDiaria[]>([]);
  const [mesSelecionado, setMesSelecionado] = useState("2026-08");
  const [dataRefPonto, setDataRefPonto] = useState("");

  useEffect(() => {
    const estado = carregarEstado();

    // Bloqueio Petrobras Fiscal (LGPD / Sigilo de dados de frequência)
    if (estado.perfilAtivo === "PETROBRAS_FISCAL") {
      router.replace("/acesso-negado");
      return;
    }

    const colab = estado.profissionais.find(
      (p) => p.id === colaboradorId || p.chapa === colaboradorId || p.matricula === colaboradorId
    );

    if (!colab) {
      setCarregando(false);
      return;
    }

    setColaborador(colab);

    // Auditoria de acesso ao espelho individual
    registrarLogAuditoria(
      "CONSULTA_ESPELHO_PONTO_INDIVIDUAL",
      `Profissional (${colab.chapa})`,
      `Visualização do espelho mensal de ponto do colaborador ${colab.nome} (Chapa ${colab.chapa}).`,
      estado.perfilAtivo || "PREMIER_ADMIN"
    );

    async function processarApuracaoEspelho() {
      // O narrowing `if (!colab) return` no escopo pai garante que colab é definido aqui.
      // A asserção abaixo satisfaz o compilador TypeScript dentro do contexto assíncrono.
      const colaborador = colab!;

      let marcacoes = obterMarcacoesPonto();
      let diasFolga = obterDiasFolgaPonto();
      let dataRef = obterDataReferenciaPonto();

      if (!marcacoes || marcacoes.length === 0) {
        try {
          const res = await fetch("/api/ponto");
          if (res.ok) {
            const data = await res.json();
            if (data.sucesso && Array.isArray(data.marcacoes) && data.marcacoes.length > 0) {
              marcacoes = data.marcacoes;
              diasFolga = data.diasFolgaRm || diasFolga;
              dataRef = data.dataReferencia || dataRef;
            }
          }
        } catch (err) {
          console.warn("Aviso: Falha ao carregar ponto via /api/ponto:", err);
        }
      }

      setDataRefPonto(dataRef);

      const horarios = carregarHorariosInterpretados();
      const ciclos = carregarCiclosColaboradores();

      // Apuração de 25/08 a 15/09
      const resultado = apurarPresencaEPostos(
        [colaborador],
        marcacoes,
        estado.ocorrencias,
        estado.coberturas,
        estado.postos,
        {
          dataInicio: "2026-08-01",
          dataFim: "2026-09-30",
          dataReferenciaUltimoLote: dataRef,
          diasSemJornadaRm: diasFolga,
        },
        horarios,
        ciclos
      );

      setApuracoesMes(resultado.apuracoesPorColaboradorDia);
      setCarregando(false);
    }

    processarApuracaoEspelho();
  }, [colaboradorId, router]);

  // Filtra por mês
  const apuracoesFiltradas = useMemo(() => {
    return apuracoesMes.filter((ap) => ap.data.startsWith(mesSelecionado));
  }, [apuracoesMes, mesSelecionado]);

  // Totais do mês
  const estatisticas = useMemo(() => {
    return {
      diasUteisPrevistos: apuracoesFiltradas.filter((a) => a.jornadaPrevista && a.situacao !== "FOLGA_ESCALA").length,
      presentes: apuracoesFiltradas.filter((a) => a.situacao === "PRESENTE").length,
      justificadas: apuracoesFiltradas.filter((a) => a.situacao === "AUSENCIA_JUSTIFICADA").length,
      faltas: apuracoesFiltradas.filter((a) => a.situacao === "FALTA").length,
      incompletas: apuracoesFiltradas.filter((a) => a.situacao === "MARCACAO_INCOMPLETA").length,
      atrasos: apuracoesFiltradas.filter((a) => a.indicadores.entradaAposHorario).length,
    };
  }, [apuracoesFiltradas]);

  function getBadgeSituacao(sit: SituacaoPresencaDiaria) {
    switch (sit) {
      case "PRESENTE":
        return <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Presente</span>;
      case "AUSENCIA_JUSTIFICADA":
        return <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">Ausência Justificada</span>;
      case "FALTA":
        return <span className="text-xs font-semibold text-red-600 dark:text-red-400">Falta</span>;
      case "MARCACAO_INCOMPLETA":
        return <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Marcação Incompleta</span>;
      case "FOLGA_ESCALA":
        return <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">Folga da Escala</span>;
      case "FERIAS_AFASTADO_LICENCA":
        return <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">Férias / Afastado</span>;
      case "ESCALA_NAO_CONFIRMADA":
        return <span className="text-xs font-semibold text-orange-600 dark:text-orange-400">Escala não confirmada</span>;
      case "SEM_DADO":
        return <span className="text-xs font-medium text-muted-foreground">Sem dado</span>;
      case "DESLIGADO":
        return <span className="text-xs font-semibold text-red-600 dark:text-red-400">Desligado</span>;
      default:
        return <span className="text-xs font-medium text-foreground">{sit}</span>;
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!colaborador) {
    return (
      <div className="p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-foreground">Colaborador não encontrado</h2>
        <button
          onClick={() => router.push("/presenca-diaria")}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium"
        >
          Voltar para Presença Diária
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Topo / Voltar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <button
            onClick={() => router.back()}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            ← Voltar
          </button>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{colaborador.nome}</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-secondary text-secondary-foreground border border-border">
              Chapa: {colaborador.chapa}
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {colaborador.funcao} • {colaborador.unidadeNome || colaborador.unidadeId} • Posto: {colaborador.postoCodigo || "Não vinculado"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={mesSelecionado}
            onChange={(e) => setMesSelecionado(e.target.value)}
            className="h-9 px-3 text-sm bg-background border border-input rounded-md font-medium"
          >
            <option value="2026-08">Competência: Agosto/2026</option>
            <option value="2026-09">Competência: Setembro/2026</option>
          </select>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border p-3 rounded-lg">
          <span className="text-xs text-muted-foreground">Dias com Jornada</span>
          <div className="text-xl font-bold text-foreground mt-1">{estatisticas.diasUteisPrevistos}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg">
          <span className="text-xs text-muted-foreground">Presenças Apuradas</span>
          <div className="text-xl font-bold text-emerald-600 mt-1">{estatisticas.presentes}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg">
          <span className="text-xs text-muted-foreground">Ausências Justif.</span>
          <div className="text-xl font-bold text-indigo-600 mt-1">{estatisticas.justificadas}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg">
          <span className="text-xs text-muted-foreground">Faltas sem Abono</span>
          <div className="text-xl font-bold text-red-600 mt-1">{estatisticas.faltas}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg">
          <span className="text-xs text-muted-foreground">Batidas Incompletas</span>
          <div className="text-xl font-bold text-amber-600 mt-1">{estatisticas.incompletas}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg">
          <span className="text-xs text-muted-foreground">Entradas c/ Atraso</span>
          <div className="text-xl font-bold text-amber-600 mt-1">{estatisticas.atrasos}</div>
        </div>
      </div>

      {/* Tabela do Espelho Diário */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Espelho de Frequência do Mês ({apuracoesFiltradas.length} dias)
          </h2>
          <span className="text-xs text-muted-foreground">
            Ponto apurado até {dataRefPonto}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Dia</th>
                <th className="px-4 py-3">Jornada Prevista</th>
                <th className="px-4 py-3">Marcações de Ponto (Local)</th>
                <th className="px-4 py-3">Situação Apurada</th>
                <th className="px-4 py-3">Origem da Marcação (Lote / Arquivo)</th>
                <th className="px-4 py-3">Observações de Gestão</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono text-xs">
              {apuracoesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground font-sans">
                    Nenhum registro para o mês selecionado.
                  </td>
                </tr>
              ) : (
                apuracoesFiltradas.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {item.data.split("-").reverse().join("/")}
                    </td>
                    <td className="px-4 py-3 font-medium text-muted-foreground">{item.diaSemana}</td>
                    <td className="px-4 py-3">
                      {item.jornadaPrevista ? (
                        <span>
                          {item.jornadaPrevista.horaInicio} - {item.jornadaPrevista.horaFim}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.marcacoesDoDia.length === 0 ? (
                        <span className="text-muted-foreground font-sans">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {item.marcacoesDoDia.map((m, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border border-border"
                            >
                              {m.horaLocal}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans">
                      {getBadgeSituacao(item.situacao)}
                      {item.indicadores.entradaAposHorario && (
                        <span className="ml-1 text-[11px] text-amber-600 font-medium">(atraso &gt; 10m)</span>
                      )}
                      {item.indicadores.saidaAntesHorario && (
                        <span className="ml-1 text-[11px] text-orange-600 font-medium">(saída antecipada &gt; 10m)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-muted-foreground text-[11px]">
                      {item.marcacoesDoDia.length > 0 ? (
                        <span>
                          Lote: {item.marcacoesDoDia[0].loteId}
                          {item.marcacoesDoDia[0].equipamento && ` (${item.marcacoesDoDia[0].equipamento})`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 font-sans text-[11px] text-muted-foreground leading-snug">
                      {item.abonoVinculado ? (
                        <span>
                          {item.abonoVinculado.tipoOcorrencia}: {item.abonoVinculado.observacaoPublica.replace(/^Abono\/Ocorrência:\s*/i, "")}
                        </span>
                      ) : item.observacaoGestao ? (
                        <span>
                          {item.observacaoGestao.texto} ({item.observacaoGestao.autor})
                        </span>
                      ) : (
                        <span>—</span>
                      )}
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
