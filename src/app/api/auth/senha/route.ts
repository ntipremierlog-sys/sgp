import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  obterSessaoServidor,
  opcoesCookieSessao,
  tokenSessaoParaCadastro,
  NOME_COOKIE_SESSAO,
} from "@/lib/auth/sessao";
import {
  alterarSenha,
  definirSenha,
  gerarTokenRedefinicao,
  redefinirSenhaComToken,
  validarTokenRedefinicao,
  exigeTrocaSenha,
  NOME_COOKIE_CRED_VAULT,
  obterVaultCredenciais,
} from "@/lib/auth/credenciais";
import { lerTokenTrocaSenha, NOME_COOKIE_TROCA_SENHA } from "@/lib/auth/token-troca-senha";
import { obterUsuarioPorEmail } from "@/lib/auth/usuarios";
import { registrarLog } from "@/lib/dados/estado-operacional";

export const dynamic = "force-dynamic";

const MENSAGEM_ESQUECI =
  "Se o e-mail estiver cadastrado como conta local ativa, você receberá as instruções de redefinição em instantes.";

function log(acao: string, detalhes: string) {
  try {
    registrarLog(acao, "Sessão", detalhes);
  } catch {
    // ignora
  }
}

/**
 * GET ?token=...  → valida link de redefinição
 * GET ?contexto=troca → informa o e-mail da troca obrigatória pendente
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (token) {
    const r = validarTokenRedefinicao(token);
    return NextResponse.json(r.ok ? { valido: true, email: r.email } : { valido: false });
  }
  const cookieStore = await cookies();
  const vaultCookie = cookieStore.get(NOME_COOKIE_CRED_VAULT)?.value;
  const emailTroca = lerTokenTrocaSenha(cookieStore.get(NOME_COOKIE_TROCA_SENHA)?.value);
  if (emailTroca) return NextResponse.json({ modo: "PRIMEIRO_ACESSO", email: emailTroca });
  const sessao = await obterSessaoServidor();
  if (sessao) return NextResponse.json({ modo: "VOLUNTARIA", email: sessao.email, obrigatoria: exigeTrocaSenha(sessao.email, vaultCookie) });
  return NextResponse.json({ modo: "SEM_SESSAO" }, { status: 401 });
}

/**
 * POST { acao: "esqueci", email }
 * POST { acao: "redefinir", token, novaSenha }
 * POST { acao: "trocar", senhaAtual?, novaSenha }
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const acao = body?.acao;

  if (acao === "esqueci") {
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) return NextResponse.json({ sucesso: false, erro: "Informe o e-mail." }, { status: 400 });
    const token = gerarTokenRedefinicao(email);
    log("SOLICITAR_REDEFINICAO_SENHA", `Solicitação de redefinição de senha para ${email}${token ? "" : " (sem conta local elegível)"}`);
    // Sem serviço de e-mail configurado: em ambiente não produtivo o link é devolvido para homologação.
    const linkDev =
      token && process.env.NODE_ENV !== "production" ? `/login/redefinir-senha?token=${encodeURIComponent(token)}` : undefined;
    return NextResponse.json({ sucesso: true, mensagem: MENSAGEM_ESQUECI, linkDev });
  }

  const novaSenha = typeof body.novaSenha === "string" ? body.novaSenha : "";
  if (!novaSenha) return NextResponse.json({ sucesso: false, erros: ["Informe a nova senha."] }, { status: 400 });

  const cookieStore = await cookies();
  const vaultCookie = cookieStore.get(NOME_COOKIE_CRED_VAULT)?.value;

  if (acao === "redefinir") {
    const r = redefinirSenhaComToken(String(body.token || ""), novaSenha);
    if (!r.ok) return NextResponse.json({ sucesso: false, erros: r.erros }, { status: 400 });
    log("REDEFINIR_SENHA", `Senha redefinida via link para ${r.email}`);
    const resposta = NextResponse.json({ sucesso: true });
    const novoVault = obterVaultCredenciais(r.email);
    if (novoVault) {
      resposta.cookies.set(NOME_COOKIE_CRED_VAULT, novoVault, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 3600,
      });
    }
    return resposta;
  }

  if (acao === "trocar") {
    const emailTroca = lerTokenTrocaSenha(cookieStore.get(NOME_COOKIE_TROCA_SENHA)?.value);

    // 1) Primeiro acesso: a senha temporária já foi conferida no login
    if (emailTroca) {
      const r = definirSenha(emailTroca, novaSenha, vaultCookie);
      if (!r.ok) return NextResponse.json({ sucesso: false, erros: r.erros }, { status: 400 });
      const usuario = obterUsuarioPorEmail(emailTroca);
      log("TROCAR_SENHA_PRIMEIRO_ACESSO", `Senha definida no primeiro acesso por ${emailTroca}`);
      const resposta = NextResponse.json({ sucesso: true, sessaoIniciada: Boolean(usuario) });
      resposta.cookies.set(NOME_COOKIE_TROCA_SENHA, "", opcoesCookieSessao(0));
      const novoVault = obterVaultCredenciais(emailTroca);
      if (novoVault) {
        resposta.cookies.set(NOME_COOKIE_CRED_VAULT, novoVault, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 365 * 24 * 3600,
        });
      }
      if (usuario && usuario.status === "ATIVO") {
        resposta.cookies.set(NOME_COOKIE_SESSAO, tokenSessaoParaCadastro(usuario), opcoesCookieSessao());
      }
      return resposta;
    }

    // 2) Troca voluntária com sessão ativa:
    const sessao = await obterSessaoServidor();
    if (!sessao) return NextResponse.json({ sucesso: false, erros: ["Sessão expirada. Entre novamente."] }, { status: 401 });
    const r = alterarSenha(sessao.email, String(body.senhaAtual || ""), novaSenha, vaultCookie);
    if (!r.ok) return NextResponse.json({ sucesso: false, erros: r.erros }, { status: 400 });
    log("TROCAR_SENHA", `Senha alterada pelo próprio usuário ${sessao.email}`);
    const resposta = NextResponse.json({ sucesso: true });
    const novoVault = obterVaultCredenciais(sessao.email);
    if (novoVault) {
      resposta.cookies.set(NOME_COOKIE_CRED_VAULT, novoVault, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 365 * 24 * 3600,
      });
    }
    return resposta;
  }

  return NextResponse.json({ sucesso: false, erro: "Ação inválida." }, { status: 400 });
}
