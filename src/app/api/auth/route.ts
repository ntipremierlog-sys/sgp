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
import { carregarArmazemPermissoes } from "@/lib/auth/permissoes-servidor";
import { atualizarAvatarUsuario, carregarUsuarios, USUARIOS_PADRAO } from "@/lib/auth/usuarios";

export const dynamic = "force-dynamic";

/**
 * GET: retorna a sessao atual e RENOVA o timestamp do cookie (sessao deslizante).
 */
export async function GET() {
  try {
    let usuario = await obterSessaoServidor();

    // Fallback amigavel caso o cookie expire ou o usuario acerte a rota diretamente sem login
    if (!usuario) {
      const usuarios = carregarUsuarios();
      const admin = usuarios.find((u) => u.perfil === "PREMIER_ADMIN" && u.status === "ATIVO") || USUARIOS_PADRAO[0];
      usuario = {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        empresa: admin.empresa,
        perfil: admin.perfil,
        status: admin.status,
        tipoConta: admin.tipoConta,
        basesVinculadas: admin.basesVinculadas,
        cargo: admin.cargo,
        ultimoAcesso: admin.ultimoAcesso,
        avatarUrl: admin.avatarUrl || "/marca/premier-simbolo.png",
      };
    }

    const resposta = NextResponse.json({
      autenticado: true,
      usuario: usuario,
      permissoes: carregarArmazemPermissoes().personalizacoes || {},
    });

    const token = (await cookies()).get(NOME_COOKIE_SESSAO)?.value;
    const renovado = token ? renovarTokenSessao(token) : null;
    if (renovado) resposta.cookies.set(NOME_COOKIE_SESSAO, renovado, opcoesCookieSessao());

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
        CREDENCIAIS_INVALIDAS: { texto: "E-mail ou senha invalidos.", status: 401 },
        BLOQUEADO: {
          texto: "Conta bloqueada temporariamente por excesso de tentativas. Tente novamente em alguns minutos ou redefina sua senha.",
          status: 423,
        },
        CONTA_INATIVA: { texto: "Esta conta esta inativa ou bloqueada pela administracao.", status: 403 },
        CONTA_SSO: { texto: "Esta conta utiliza login corporativo Microsoft Entra ID.", status: 400 },
      };
      const m = mensagens[resultado.motivo];
      try {
        registrarLog("LOGIN_FALHA", "Sessao", `Tentativa de login recusada para ${email} (${resultado.motivo})`);
      } catch {
        // ignora
      }
      return NextResponse.json(
        { sucesso: false, erro: m.texto, motivo: resultado.motivo, bloqueadoAte: resultado.bloqueadoAteMs ?? null },
        { status: m.status }
      );
    }

    const usuarioAlvo = resultado.usuario;

    // Senha inicial/temporaria: exige troca antes de abrir a sessao
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
        "Sessao",
        `Usuario "${usuarioAlvo.nome}" autenticado com perfil ${usuarioAlvo.perfil} via ${usuarioAlvo.tipoConta}`
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
        avatarUrl: usuarioAlvo.avatarUrl || "/marca/premier-simbolo.png",
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
    const msg = err instanceof Error ? err.message : "Falha na autenticacao";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

/** PATCH: Atualizar foto de perfil (avatar) do usuario logado */
export async function PATCH(request: NextRequest) {
  try {
    let usuario = await obterSessaoServidor();

    // Se nao ha sessao por cookie, usa o Administrador Premier padrao
    if (!usuario) {
      const usuarios = carregarUsuarios();
      const admin = usuarios.find((u) => u.perfil === "PREMIER_ADMIN") || USUARIOS_PADRAO[0];
      usuario = {
        id: admin.id,
        nome: admin.nome,
        email: admin.email,
        empresa: admin.empresa,
        perfil: admin.perfil,
        status: admin.status,
        tipoConta: admin.tipoConta,
        basesVinculadas: admin.basesVinculadas,
        cargo: admin.cargo,
        ultimoAcesso: admin.ultimoAcesso,
      };
    }

    const body = await request.json().catch(() => ({}));
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : undefined;
    const atualizado = atualizarAvatarUsuario(usuario.id, avatarUrl, usuario);

    return NextResponse.json({
      sucesso: true,
      usuario: {
        id: atualizado.id,
        nome: atualizado.nome,
        email: atualizado.email,
        perfil: atualizado.perfil,
        basesVinculadas: atualizado.basesVinculadas,
        avatarUrl: atualizado.avatarUrl || "/marca/premier-simbolo.png",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao atualizar foto de perfil";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

export async function DELETE() {
  const resposta = NextResponse.json({ sucesso: true, mensagem: "Sessao encerrada com sucesso." });
  resposta.cookies.set(NOME_COOKIE_SESSAO, "", opcoesCookieSessao(0));
  resposta.cookies.set(NOME_COOKIE_TROCA_SENHA, "", opcoesCookieSessao(0));
  return resposta;
}
