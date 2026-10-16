import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import {
  registrarParecerFiscalLote,
  obterParecerPosicaoDia,
  obterPreviaServidor,
  ConferenciaInvalidaError,
  PeriodoCongeladoError,
} from "@/lib/repositorio";
import { PERFIS_PARECER_FISCAL } from "@/lib/servicos/conferencia-perfis";

export const dynamic = "force-dynamic";

/**
 * GET /api/conferencia/parecer?posicaoId=POS-...&data=AAAA-MM-DD
 * Parecer vigente da posição-dia na prévia que contém a data (usado no Mapa de Ocupação).
 */
export async function GET(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  try {
    const { searchParams } = new URL(request.url);
    const posicaoId = searchParams.get("posicaoId") || "";
    const data = (searchParams.get("data") || "").slice(0, 10);
    if (!posicaoId || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      return NextResponse.json({ sucesso: false, erro: "Informe posicaoId e data." }, { status: 400 });
    }
    const previa = await obterPreviaServidor(data);
    const parecer = await obterParecerPosicaoDia(posicaoId, data, previa);
    return NextResponse.json({ sucesso: true, previa, parecer });
  } catch (erro: any) {
    return NextResponse.json({ sucesso: false, erro: erro?.message || "Falha ao consultar o parecer." }, { status: 500 });
  }
}

/**
 * POST /api/conferencia/parecer — parecer da fiscal (uma ou várias linhas).
 * Body: { competencia, previaNumero, linhas: [{ posicaoId, data }], status, comentario, horasDescobertas }
 * Somente inclusão: cada parecer é uma nova linha em conferencia_previa (tipo POSICAO_DIA).
 */
export async function POST(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  if (!PERFIS_PARECER_FISCAL.includes(usuario.perfil)) {
    return NextResponse.json({ sucesso: false, erro: "Somente a Fiscal Petrobras (ou Premier/Administração) registra parecer." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const r = await registrarParecerFiscalLote(
      {
        competencia: String(body.competencia || ""),
        previaNumero: Number(body.previaNumero),
        linhas: Array.isArray(body.linhas) ? body.linhas : [],
        status: body.status,
        comentario: body.comentario,
        horasDescobertas: body.horasDescobertas,
      },
      usuario.email || usuario.nome || "usuario-sistema"
    );
    return NextResponse.json({ sucesso: true, total: r.total }, { status: 201 });
  } catch (erro: any) {
    if (erro instanceof ConferenciaInvalidaError) return NextResponse.json({ sucesso: false, erro: erro.message }, { status: 422 });
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json({ sucesso: false, erro: erro.message, codigo: erro.codigo }, { status: erro.statusCode });
    }
    return NextResponse.json({ sucesso: false, erro: erro?.message || "Falha ao registrar o parecer." }, { status: 400 });
  }
}
