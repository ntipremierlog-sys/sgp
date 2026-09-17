"use client";

/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Tela de Presença Diária por Colaborador e Posto
 *
 * Exclusivo para perfis Premier (Admin, Gestor, RH).
 * Fiscal Petrobras tem visualização estritamente segregada via Mapa de Ocupação.
 */

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  carregarEstado,
  obterMarcacoesPonto,
  obterDataReferenciaPonto,
  registrarLogAuditoria,
} from "@/lib/dados/estado-operacional";
import { apurarPresencaEPostos } from "@/lib/servicos/apuracao-presenca";
import { carregarHorariosInterpretados, carregarCiclosColaboradores } from "@/lib/servicos/interpretador-horarios";
import { BASES_SGP_SISTEMA } from "@/lib/dados/secoes-horarios";
import { ApuracaoPresencaDiaria, SituacaoPresencaDiaria } from "@/lib/dados/ponto-tipos";

export default function PresencaDiariaPage() {
  const router = useRouter();
  const [carregando, setCarregando] = useState(true);
  const [perfilAtivo, setPerfilAtivo] = useState("PREMIER_ADMIN");
  const [dataSelecionada, setDataSelecionada] = useState("2026-08-31");
  const [baseFiltro, setBaseFiltro] = useState("TODAS");
  const [situacaoFiltro, setSituacaoFiltro] = useState("TODAS");
  const [buscaTexto, setBuscaTexto] = useState("");

  const [apuracoesCompletas, setApuracoesCompletas] = useState<ApuracaoPresencaDiaria[]>([]);
  const [dataRefLote, setDataRefLote] = useState("2026-09-15 23:59");

  useEffect(() => {
    const estado = carregarEstado();
    setPerfilAtivo(estado.perfilAtivo || "PREMIER_ADMIN");

    // Segregação estrita LGPD e RBAC: Fiscal Petrobras não acessa marcações individuais
    if (estado.perfilAtivo === "PETROBRAS_FISCAL") {
      router.replace("/painel");
      return;
    }

    // Registra acesso na auditoria
    registrarLogAuditoria(
      "ACESSO_TELA_PRESENCA_DIARIA",
      "PresencaDiaria",
      "Consulta às marcações diárias e apuração de frequência dos colaboradores.",
      estado.perfilAtivo || "PREMIER_ADMIN"
    );

    const marcacoes = obterMarcacoesPonto();
    const dataRef = obterDataReferenciaPonto();
    setDataRefLote(dataRef);

    const horarios = carregarHorariosInterpretados();
    const ciclos = carregarCiclosColaboradores();

    // Executa a apuração no intervalo representativo
    const resultado = apurarPresencaEPostos(
      estado.profissionais,
      marcacoes,
      estado.ocorrencias,
      estado.coberturas,
      estado.postos,
      {
        dataInicio: "2026-08-25",
        dataFim: "2026-09-15",
        dataReferenciaUltimoLote: dataRef,
      },
      horarios,
      ciclos
    );

    setApuracoesCompletas(resultado.apuracoesPorColaboradorDia);
    setCarregando(false);
  }, [router]);

  // Filtra as apurações para o dia e filtros ativos
  const apuracoesDoDia = useMemo(() => {
    return apuracoesCompletas.filter((ap) => {
      if (ap.data !== dataSelecionada) return false;
      if (baseFiltro !== "TODAS" && ap.baseId !== baseFiltro) return false;
      if (situacaoFiltro !== "TODAS" && ap.situacao !== situacaoFiltro) return false;
      if (buscaTexto.trim()) {
        const termo = buscaTexto.toLowerCase();
        const nomeMatch = ap.nomeColaborador.toLowerCase().includes(termo);
        const chapaMatch = ap.chapa.includes(termo);
        const postoMatch = (ap.postoCodigo || "").toLowerCase().includes(termo);
        if (!nomeMatch && !chapaMatch && !postoMatch) return false;
      }
      return true;
    });
  }, [apuracoesCompletas, dataSelecionada, baseFiltro, situacaoFiltro, buscaTexto]);

  // Contadores do dia selecionado
  const totaisDia = useMemo(() => {
    const doDia = apuracoesCompletas.filter((ap) => ap.data === dataSelecionada);
    return {
      total: doDia.length,
      presentes: doDia.filter((a) => a.situacao === "PRESENTE").length,
      justificadas: doDia.filter((a) => a.situacao === "AUSENCIA_JUSTIFICADA").length,
      faltas: doDia.filter((a) => a.situacao === "FALTA").length,
      incompletas: doDia.filter((a) => a.situacao === "MARCACAO_INCOMPLETA").length,
      folgas: doDia.filter((a) => a.situacao === "FOLGA_ESCALA").length,
      feriasAfastados: doDia.filter((a) => a.situacao === "FERIAS_AFASTADO_LICENCA").length,
      semDado: doDia.filter((a) => a.situacao === "SEM_DADO").length,
    };
  }, [apuracoesCompletas, dataSelecionada]);

  function getBadgeSituacao(sit: SituacaoPresencaDiaria) {
    switch (sit) {
      case "PRESENTE":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">Presente</span>;
      case "AUSENCIA_JUSTIFICADA":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">Ausência Justificada</span>;
      case "FALTA":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">Falta</span>;
      case "MARCACAO_INCOMPLETA":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-800">Marcação Incompleta</span>;
      case "FOLGA_ESCALA":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">Folga da Escala</span>;
      case "FERIAS_AFASTADO_LICENCA":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Férias / Afastado</span>;
      case "ESCALA_NAO_CONFIRMADA":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Escala não confirmada</span>;
      case "SEM_DADO":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-600">Sem dado</span>;
      case "DESLIGADO":
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-700">Desligado</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700">{sit}</span>;
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
      {/* Cabeçalho */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Presença Diária dos Colaboradores</h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
              Momento 4
            </span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Apuração diária de presença e cumprimento de turnos para gestão de cobertura contratual Petrobras.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right text-xs">
            <span className="text-muted-foreground">Ponto importado até:</span>
            <div className="font-semibold text-foreground">{dataRefLote}</div>
          </div>
        </div>
      </div>

      {/* Cards de Resumo do Dia */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card border border-border p-3 rounded-lg shadow-sm">
          <span className="text-xs text-muted-foreground">Presentes</span>
          <div className="text-xl font-bold text-emerald-600 mt-1">{totaisDia.presentes}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg shadow-sm">
          <span className="text-xs text-muted-foreground">Ausências Justif.</span>
          <div className="text-xl font-bold text-indigo-600 mt-1">{totaisDia.justificadas}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg shadow-sm">
          <span className="text-xs text-muted-foreground">Faltas sem Abono</span>
          <div className="text-xl font-bold text-red-600 mt-1">{totaisDia.faltas}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg shadow-sm">
          <span className="text-xs text-muted-foreground">Marcações Incompletas</span>
          <div className="text-xl font-bold text-amber-600 mt-1">{totaisDia.incompletas}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg shadow-sm">
          <span className="text-xs text-muted-foreground">Folgas da Escala</span>
          <div className="text-xl font-bold text-slate-600 mt-1">{totaisDia.folgas}</div>
        </div>
        <div className="bg-card border border-border p-3 rounded-lg shadow-sm">
          <span className="text-xs text-muted-foreground">Férias / Afastados</span>
          <div className="text-xl font-bold text-blue-600 mt-1">{totaisDia.feriasAfastados}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-card border border-border p-4 rounded-xl shadow-sm space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
              Data de Referência
            </label>
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
              Base Operacional
            </label>
            <select
              value={baseFiltro}
              onChange={(e) => setBaseFiltro(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="TODAS">Todas as Bases</option>
              {BASES_SGP_SISTEMA.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.nome} ({b.fusoHorario.replace("America/", "")})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
              Situação da Presença
            </label>
            <select
              value={situacaoFiltro}
              onChange={(e) => setSituacaoFiltro(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="TODAS">Todas as Situações</option>
              <option value="PRESENTE">Presente</option>
              <option value="AUSENCIA_JUSTIFICADA">Ausência Justificada (Abono)</option>
              <option value="FALTA">Falta</option>
              <option value="MARCACAO_INCOMPLETA">Marcação Incompleta</option>
              <option value="FOLGA_ESCALA">Folga da Escala</option>
              <option value="FERIAS_AFASTADO_LICENCA">Férias / Afastado</option>
              <option value="ESCALA_NAO_CONFIRMADA">Escala não confirmada</option>
              <option value="SEM_DADO">Sem dado</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1">
              Buscar Colaborador / Chapa
            </label>
            <input
              type="text"
              placeholder="Digite nome, chapa ou posto..."
              value={buscaTexto}
              onChange={(e) => setBuscaTexto(e.target.value)}
              className="w-full h-9 px-3 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Tabela de Presença Diária */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Colaboradores Apurados no Dia ({apuracoesDoDia.length} registros)
          </h2>
          <span className="text-xs text-muted-foreground">
            Exibição em horário local da respectiva base operacional
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
              <tr>
                <th className="px-4 py-3">Chapa / Nome</th>
                <th className="px-4 py-3">Base / Posto</th>
                <th className="px-4 py-3">Jornada Prevista</th>
                <th className="px-4 py-3">Marcações do Dia (Horário Local)</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Indicadores</th>
                <th className="px-4 py-3 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {apuracoesDoDia.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Nenhum colaborador encontrado com os filtros selecionados para esta data.
                  </td>
                </tr>
              ) : (
                apuracoesDoDia.map((item) => (
                  <tr key={item.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-medium">
                      <div className="text-foreground">{item.nomeColaborador}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        Chapa: {item.chapa} | CPF: {item.cpfMascarado}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-semibold text-foreground">{item.baseNome}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.postoCodigo || "Posto não vinculado"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item.jornadaPrevista ? (
                        <div>
                          <span className="font-mono font-semibold">
                            {item.jornadaPrevista.horaInicio} às {item.jornadaPrevista.horaFim}
                          </span>
                          <div className="text-muted-foreground text-[11px]">
                            Escala: {item.jornadaPrevista.tipoEscala}
                            {item.jornadaPrevista.atravessaMeiaNoite && " (Noturna)"}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Sem jornada</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {item.marcacoesDoDia.length === 0 ? (
                        <span className="text-xs text-muted-foreground italic">Sem marcação</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {item.marcacoesDoDia.map((m, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-mono bg-secondary text-secondary-foreground border border-border"
                              title={`UTC: ${m.horaUtc}`}
                            >
                              {m.horaLocal}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {getBadgeSituacao(item.situacao)}
                      {item.abonoVinculado && (
                        <div className="text-[11px] text-indigo-700 dark:text-indigo-300 mt-0.5 font-medium truncate max-w-[200px]" title={item.abonoVinculado.observacaoPublica}>
                          {item.abonoVinculado.observacaoPublica}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="space-y-0.5">
                        {item.indicadores.entradaAposHorario && (
                          <span className="inline-block text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">
                            Entrada após o horário
                          </span>
                        )}
                        {item.indicadores.saidaAntesHorario && (
                          <span className="inline-block text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded">
                            Saída antes do horário
                          </span>
                        )}
                        {item.indicadores.abonoParcial && (
                          <span className="inline-block text-[11px] text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 px-1.5 py-0.2 rounded">
                            Abono parcial
                          </span>
                        )}
                        {!item.indicadores.entradaAposHorario &&
                          !item.indicadores.saidaAntesHorario &&
                          !item.indicadores.abonoParcial && (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => router.push(`/profissionais/${item.colaboradorId}/espelho-ponto`)}
                        className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
                      >
                        Espelho
                      </button>
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
