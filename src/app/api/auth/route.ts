import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  obterSessaoServidor,
  renovarTokenSessao,
  opcoesCookieSessao,
  tokenSessaoParaCadastro as tokenParaUsuario,
  NOME_COOKIE_SESSAO,
} from "@/lib/auth/sessao";
import { autenticarComSenha, NOME_COOKIE_CRED_VAULT, obterVaultCredenciais } from "@/lib/auth/credenciais";
import { emitirTokenTrocaSenha, NOME_COOKIE_TROCA_SENHA, VALIDADE_TROCA_SENHA_S } from "@/lib/auth/token-troca-senha";
import { registrarLog } from "@/lib/dados/estado-operacional";

export const dynamic = "force-dynamic";

/**
 * GET: retorna a sessão atual e RENOVA o timestamp do cookie (sessão deslizante).
 * Sem isso a sessão expirava 30 min após o login mesmo com o usuário ativo.
 */
export async function GET() {
  try {
    const usuario = await obterSessaoServidor();
    const resposta = NextResponse.json({
      autenticado: !!usuario,
      usuario: usuario || null,
    });
    if (usuario) {
      const token = (await cookies()).get(NOME_COOKIE_SESSAO)?.value;
      const renovado = token ? renovarTokenSessao(token) : null;
      if (renovado) resposta.cookies.set(NOME_COOKIE_SESSAO, renovado, opcoesCookieSessao());
    }
    return resposta;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno";
    return NextResponse.json({ autenticado: false, usuario: null, erro: msg }, { status: 500 });
  }
}

/** POST: login com e-mail e senha (contas locais). */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const senha = typeof body.senha === "string" ? body.senha : "";

    if (!email || !senha) {
      return NextResponse.json({ sucesso: false, erro: "Informe e-mail e senha." }, { status: 400 });
    }

    const vaultCookie = request.cookies.get(NOME_COOKIE_CRED_VAULT)?.value;
    const resultado = autenticarComSenha(email, senha, vaultCookie);

    if (!resultado.ok) {
      const mensagens: Record<typeof resultado.motivo, { texto: string; status: number }> = {
        CREDENCIAIS_INVALIDAS: { texto: "E-mail ou senha inválidos.", status: 401 },
        BLOQUEADO: {
          texto: "Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em alguns minutos ou redefina sua senha.",
          status: 423,
        },
        CONTA_INATIVA: { texto: "Esta conta está inativa ou bloqueada pela administração.", status: 403 },
        CONTA_SSO: { texto: "Esta conta utiliza login corporativo Microsoft Entra ID.", status: 400 },
      };
      const m = mensagens[resultado.motivo];
      try {
        registrarLog("LOGIN_FALHA", "Sessão", `Tentativa de login recusada para ${email} (${resultado.motivo})`);
      } catch {
        // ignora
      }
      return NextResponse.json(
        { sucesso: false, erro: m.texto, motivo: resultado.motivo, bloqueadoAte: resultado.bloqueadoAteMs ?? null },
        { status: m.status }
      );
    }

    const usuarioAlvo = resultado.usuario;

    // Senha inicial/temporária: exige troca antes de abrir a sessão
    if (resultado.trocarSenha) {
      const resposta = NextResponse.json({ sucesso: true, trocarSenha: true, email: usuarioAlvo.email });
      resposta.cookies.set(NOME_COOKIE_TROCA_SENHA, emitirTokenTrocaSenha(usuarioAlvo.email), {
        ...opcoesCookieSessao(VALIDADE_TROCA_SENHA_S),
      });
      return resposta;
    }

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
    resposta.cookies.set(NOME_COOKIE_SESSAO, tokenParaUsuario(usuarioAlvo), opcoesCookieSessao());
    const vaultToken = obterVaultCredenciais(usuarioAlvo.email);
    if (vaultToken) {
      resposta.cookies.set(NOME_COOKIE_CRED_VAULT, vaultToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 3600,
      });
    }
    return resposta;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Falha na autenticação";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const resposta = NextResponse.json({ sucesso: true, mensagem: "Sessão encerrada com sucesso." });
  resposta.cookies.set(NOME_COOKIE_SESSAO, "", opcoesCookieSessao(0));
  resposta.cookies.set(NOME_COOKIE_TROCA_SENHA, "", opcoesCookieSessao(0));
  return resposta;
}
