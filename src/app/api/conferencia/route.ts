import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import {
  apurarConferenciaPrevia,
  obterPreviaConferencia,
  obterPreviaServidor,
  ConferenciaInvalidaError,
} from "@/lib/repositorio";
import { hojeBrasil } from "@/lib/servicos/previas";
import {
  PERFIS_CONFERENCIA,
  PERFIS_PARECER_FISCAL,
  PERFIS_JUSTIFICATIVA_PREMIER,
} from "@/lib/servicos/conferencia-perfis";

export const dynamic = "force-dynamic";

/**
 * GET /api/conferencia?competencia=AAAA-MM&previa=N[&imovel=][&posto=ID][&exportar=1]
 * - sem posto: indicadores + Nível 1 (postos)
 * - com posto: Nível 2 (linhas posição-dia do posto)
 * - exportar=1: todas as linhas do Nível 2 (para o Excel)
 * LGPD: as linhas trazem apenas nome e chapa do colaborador, tipo público da ocorrência,
 * justificativa Premier e parecer — nada de CID, diagnóstico, médico, CRM ou comentários internos.
 */
export async function GET(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  if (!PERFIS_CONFERENCIA.includes(usuario.perfil)) {
    return NextResponse.json({ sucesso: false, erro: "Conferência disponível para Fiscal Petrobras e Premier (Administração e Gestor)." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const competencia = searchParams.get("competencia");
    const numero = Number(searchParams.get("previa") || 0);
    const imovel = searchParams.get("imovel") || undefined;
    const posto = searchParams.get("posto") || undefined;
    const exportar = searchParams.get("exportar") === "1";

    const previa = competencia && numero ? await obterPreviaConferencia(competencia, numero) : await obterPreviaServidor(hojeBrasil());
    const permissoes = {
      podeDarParecer: PERFIS_PARECER_FISCAL.includes(usuario.perfil),
      podeJustificar: PERFIS_JUSTIFICATIVA_PREMIER.includes(usuario.perfil),
    };

    if (posto) {
      const r = await apurarConferenciaPrevia(previa, { postoIds: [posto] });
      return NextResponse.json({
        sucesso: true,
        perfil: usuario.perfil,
        permissoes,
        previa,
        posto: r.postos[0] || null,
        linhas: r.linhas,
      });
    }

    const r = await apurarConferenciaPrevia(previa, { imovel });
    if (exportar) {
      const infoPosto = new Map(r.postos.map((p) => [p.postoId, p]));
      return NextResponse.json({
        sucesso: true,
        previa,
        linhas: r.linhas.map((l) => ({
          ...l,
          imovel: infoPosto.get(l.postoId)?.imovel || "",
          postoCodigo: infoPosto.get(l.postoId)?.codigoPosto || "",
          postoDescricao: infoPosto.get(l.postoId)?.descricao || "",
        })),
      });
    }
    return NextResponse.json({
      sucesso: true,
      perfil: usuario.perfil,
      permissoes,
      previa,
      imoveis: r.imoveis,
      indicadores: r.indicadores,
      postos: r.postos,
    });
  } catch (erro: any) {
    if (erro instanceof ConferenciaInvalidaError) {
      return NextResponse.json({ sucesso: false, erro: erro.message }, { status: 422 });
    }
    console.error("Erro na API de Conferência:", erro);
    return NextResponse.json({ sucesso: false, erro: erro?.message || "Falha ao apurar a conferência." }, { status: 500 });
  }
}
