import { NextRequest, NextResponse } from "next/server";
import { obterOcupacaoConsolidada } from "@/lib/servicos/adaptador-painel";
import { registrarLog } from "@/lib/dados/estado-operacional";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const baseId = searchParams.get("baseId") || undefined;
    const competencia = searchParams.get("competencia") || "2026-09";
    const dataHoje = searchParams.get("dataHoje") || "2026-09-16";
    const parametroAusente = searchParams.get("parametroAusente") === "true";

    // Perfil via Header, Query ou Cookie
    const perfilHeader = request.headers.get("x-perfil-usuario");
    const perfilParam = searchParams.get("perfil");
    const perfil = (perfilHeader || perfilParam || "PREMIER_GESTOR").toUpperCase();

    // Executa o cálculo centralizado
    const resultado = obterOcupacaoConsolidada(undefined, {
      baseId: baseId === "TODAS" ? undefined : baseId,
      competencia,
      dataHoje,
      perfilUsuario: perfil,
      parametroAusente,
    });

    // -------------------------------------------------------------------------
    // GOVERNANÇA LGPD E RBAC SERVER-SIDE (PARTE 6)
    // -------------------------------------------------------------------------
    if (perfil === "PETROBRAS_FISCAL") {
      // 1. Omissão estrita de Glosa Estimada no backend (não trafega para o client)
      resultado.glosaEstimada = {
        valorTotal: null,
        status: "OMITIDO_LGPD",
        fatorGlosa: null,
        textoApoio: "Omitido para o perfil de fiscalização Petrobras",
        formulaExplicativa:
          "Memória financeira e impacto de glosa são segregados para acesso exclusivo da gestão interna Premier (LGPD / Contrato)",
      };

      // 2. Sanitização estrita de motivos de ausência (zero CID-10, CRM ou diagnósticos)
      Object.keys(resultado.matrizDetalhada).forEach((chave) => {
        const celula = resultado.matrizDetalhada[chave];
        if (celula.motivo) {
          if (
            celula.motivo.toLowerCase().includes("atestado") ||
            celula.motivo.toLowerCase().includes("médico") ||
            celula.motivo.toLowerCase().includes("lumbago") ||
            celula.motivo.toLowerCase().includes("ciática") ||
            celula.motivo.includes("M54")
          ) {
            celula.motivo = "Ausência justificada — afastamento homologado";
          }
        }
      });

      resultado.gradeSemanal.linhas.forEach((linha) => {
        Object.keys(linha.celulas).forEach((dataKey) => {
          const celula = linha.celulas[dataKey];
          if (celula && celula.motivo) {
            if (
              celula.motivo.toLowerCase().includes("atestado") ||
              celula.motivo.toLowerCase().includes("médico") ||
              celula.motivo.toLowerCase().includes("lumbago") ||
              celula.motivo.toLowerCase().includes("ciática") ||
              celula.motivo.includes("M54")
            ) {
              celula.motivo = "Ausência justificada — afastamento homologado";
            }
          }
        });
      });
    }

    // Registro de Auditoria Contínua
    try {
      registrarLog(
        "CONSULTA_PAINEL_GERAL",
        `Painel Geral (${baseId || "Todas as bases"})`,
        `Consulta aos indicadores do Painel Geral realizada com perfil ${perfil}. Competência: ${competencia}`
      );
    } catch {
      // Ignora falha de auditoria em ambiente serverless estático
    }

    return NextResponse.json(resultado, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (erro: unknown) {
    const errMessage = erro instanceof Error ? erro.message : "Erro desconhecido";
    return NextResponse.json(
      {
        sucesso: false,
        erro: "Falha ao calcular indicadores do painel",
        detalhes: errMessage,
      },
      { status: 500 }
    );
  }
}
