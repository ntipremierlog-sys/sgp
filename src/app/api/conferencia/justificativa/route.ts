import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { registrarJustificativaPremier, ConferenciaInvalidaError, PeriodoCongeladoError } from "@/lib/repositorio";
import { PERFIS_JUSTIFICATIVA_PREMIER } from "@/lib/servicos/conferencia-perfis";

export const dynamic = "force-dynamic";

/**
 * POST /api/conferencia/justificativa — justificativa da Premier para uma linha (posição-dia).
 * Body: { competencia, previaNumero, posicaoId, data, texto }. Somente inclusão.
 */
export async function POST(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  if (!PERFIS_JUSTIFICATIVA_PREMIER.includes(usuario.perfil)) {
    return NextResponse.json({ sucesso: false, erro: "Somente perfis Premier registram justificativa." }, { status: 403 });
  }
  try {
    const body = await request.json();
    const j = await registrarJustificativaPremier(
      {
        competencia: String(body.competencia || ""),
        previaNumero: Number(body.previaNumero),
        posicaoId: String(body.posicaoId || ""),
        data: String(body.data || "").slice(0, 10),
        texto: String(body.texto || ""),
      },
      usuario.email || usuario.nome || "usuario-sistema"
    );
    return NextResponse.json({ sucesso: true, id: j.id }, { status: 201 });
  } catch (erro: any) {
    if (erro instanceof ConferenciaInvalidaError) return NextResponse.json({ sucesso: false, erro: erro.message }, { status: 422 });
    if (erro instanceof PeriodoCongeladoError) {
      return NextResponse.json({ sucesso: false, erro: erro.message, codigo: erro.codigo }, { status: erro.statusCode });
    }
    return NextResponse.json({ sucesso: false, erro: erro?.message || "Falha ao registrar a justificativa." }, { status: 400 });
  }
}
