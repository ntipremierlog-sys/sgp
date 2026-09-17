import { NextRequest, NextResponse } from "next/server";
import {
  obterSessaoServidor,
  codificarTokenSessao,
  NOME_COOKIE_SESSAO,
} from "@/lib/auth/sessao";
import {
  carregarUsuarios,
  obterUsuarioPorEmail,
  obterUsuarioPorId,
} from "@/lib/auth/usuarios";
import { registrarLog } from "@/lib/dados/estado-operacional";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const usuario = await obterSessaoServidor();
    return NextResponse.json({
      autenticado: !!usuario,
      usuario: usuario || null,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ autenticado: false, usuario: null, erro: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { usuarioId, email } = body;

    let usuarioAlvo = usuarioId ? obterUsuarioPorId(usuarioId) : undefined;
    if (!usuarioAlvo && email) {
      usuarioAlvo = obterUsuarioPorEmail(email);
    }

    if (!usuarioAlvo) {
      return NextResponse.json(
        { sucesso: false, erro: "Usuário não encontrado no cadastro corporativo." },
        { status: 404 }
      );
    }

    if (usuarioAlvo.status !== "ATIVO") {
      return NextResponse.json(
        { sucesso: false, erro: "Esta conta está inativa ou bloqueada pela administração." },
        { status: 403 }
      );
    }

    const token = codificarTokenSessao({
      id: usuarioAlvo.id,
      nome: usuarioAlvo.nome,
      email: usuarioAlvo.email,
      empresa: usuarioAlvo.empresa,
      perfil: usuarioAlvo.perfil,
      status: usuarioAlvo.status,
      tipoConta: usuarioAlvo.tipoConta,
      basesVinculadas: usuarioAlvo.basesVinculadas,
      cargo: usuarioAlvo.cargo,
      ultimoAcesso: new Date().toISOString(),
    });

    try {
      registrarLog(
        "LOGIN",
        "Sessão",
        `Usuário "${usuarioAlvo.nome}" autenticado com perfil ${usuarioAlvo.perfil} via ${usuarioAlvo.tipoConta}`
      );
    } catch {
      // ignora
    }

    const resposta = NextResponse.json({
      sucesso: true,
      usuario: {
        id: usuarioAlvo.id,
        nome: usuarioAlvo.nome,
        email: usuarioAlvo.email,
        perfil: usuarioAlvo.perfil,
        basesVinculadas: usuarioAlvo.basesVinculadas,
      },
    });

    // Define cookie HTTP-Only seguro
    resposta.cookies.set(NOME_COOKIE_SESSAO, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });

    return resposta;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha na autenticação";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const resposta = NextResponse.json({ sucesso: true, mensagem: "Sessão encerrada com sucesso." });
  resposta.cookies.set(NOME_COOKIE_SESSAO, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return resposta;
}
