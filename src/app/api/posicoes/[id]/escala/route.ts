import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { atualizarEscalaPosicao } from "@/lib/repositorio";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const usuarioIdentificador = usuario.email || usuario.nome || "usuario-sistema";
    const atualizada = await atualizarEscalaPosicao(decodeURIComponent(id), body, usuarioIdentificador);

    return NextResponse.json({
      sucesso: true,
      posicao: atualizada,
    });
  } catch (erro: any) {
    console.error("Erro ao atualizar escala da posição:", erro);
    return NextResponse.json(
      { sucesso: false, erro: erro?.message || "Falha ao atualizar escala da posição." },
      { status: 400 }
    );
  }
}
