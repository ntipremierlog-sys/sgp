import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Middleware de autenticação (Edge).
 * - Todas as telas exigem sessão válida (token assinado + inatividade < 30 min), exceto /login/*.
 * - A cada navegação o timestamp do token é renovado (sessão deslizante).
 * - /admin e /api/admin continuam restritos ao perfil PREMIER_ADMIN.
 *
 * O algoritmo de assinatura (HMAC-SHA256 sobre o payload base64) é o mesmo de src/lib/auth/sessao.ts.
 */

const NOME_COOKIE_SESSAO = "sgp_session_token";
const TIMEOUT_INATIVIDADE_MS = 30 * 60 * 1000;
const DURACAO_COOKIE_SESSAO_S = 12 * 60 * 60;
const ROTAS_PUBLICAS = ["/login", "/acesso-negado"];

function obterSegredo(): string {
  return process.env.NEXTAUTH_SECRET || "sgp-dev-segredo-local-nao-usar-em-producao";
}

function paraBase64Url(bytes: ArrayBuffer): string {
  let bin = "";
  const arr = new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function assinar(payloadB64: string): Promise<string> {
  const chave = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(obterSegredo()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign("HMAC", chave, new TextEncoder().encode(payloadB64));
  return paraBase64Url(assinatura);
}

function base64Utf8ParaTexto(b64: string): string {
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function textoParaBase64Utf8(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

type PayloadSessao = { userId: string; perfil?: string; status?: string; timestamp?: number; [k: string]: unknown };

async function lerSessao(token: string | undefined): Promise<{ payload: PayloadSessao | null; expirada: boolean }> {
  if (!token) return { payload: null, expirada: false };
  const [payloadB64, assinatura] = token.split(".");
  if (!payloadB64 || !assinatura) return { payload: null, expirada: false };
  try {
    if ((await assinar(payloadB64)) !== assinatura) return { payload: null, expirada: false };
    const payload = JSON.parse(base64Utf8ParaTexto(payloadB64)) as PayloadSessao;
    if (!payload || typeof payload.userId !== "string") return { payload: null, expirada: false };
    if (payload.timestamp && Date.now() - payload.timestamp > TIMEOUT_INATIVIDADE_MS) {
      return { payload: null, expirada: true };
    }
    return { payload, expirada: false };
  } catch {
    return { payload: null, expirada: false };
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const ehApi = pathname.startsWith("/api/");
  const ehPublica = ROTAS_PUBLICAS.some((r) => pathname === r || pathname.startsWith(r + "/"));

  const token = request.cookies.get(NOME_COOKIE_SESSAO)?.value;
  const { payload, expirada } = await lerSessao(token);

  // Telas públicas (login e afins)
  if (ehPublica) {
    // Já autenticado tentando abrir /login → vai para o sistema
    if (payload && pathname === "/login") {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Sem sessão válida → login (APIs de admin respondem 403 JSON)
  if (!payload) {
    if (ehApi) {
      return NextResponse.json(
        { sucesso: false, erro: expirada ? "Sessão expirada por inatividade." : "Autenticação necessária." },
        { status: 401 }
      );
    }
    const urlLogin = new URL("/login", request.url);
    if (pathname !== "/") urlLogin.searchParams.set("destino", pathname + search);
    if (expirada) urlLogin.searchParams.set("expirado", "inatividade");
    const resposta = NextResponse.redirect(urlLogin);
    if (token) resposta.cookies.set(NOME_COOKIE_SESSAO, "", { path: "/", maxAge: 0 });
    return resposta;
  }

  // Proteção de rotas da Administração: /admin e /api/admin
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const ehAdmin = payload.perfil === "PREMIER_ADMIN";
    const ehAtivo = (payload.status || "ATIVO") === "ATIVO";
    if (!ehAdmin || !ehAtivo) {
      if (ehApi) {
        return NextResponse.json(
          {
            sucesso: false,
            erro: "Acesso não permitido. Módulo restrito exclusivamente ao perfil Administrador Premier.",
          },
          { status: 403 }
        );
      }
      // Para páginas web, redireciona para a tela segura de Acesso Negado sem vazamento de dados
      return NextResponse.redirect(new URL("/acesso-negado", request.url));
    }
  }

  // Sessão deslizante: renova o timestamp a cada navegação
  const resposta = NextResponse.next();
  try {
    const novoB64 = textoParaBase64Utf8(JSON.stringify({ ...payload, timestamp: Date.now() }));
    resposta.cookies.set(NOME_COOKIE_SESSAO, `${novoB64}.${await assinar(novoB64)}`, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DURACAO_COOKIE_SESSAO_S,
    });
  } catch {
    // mantém o cookie atual
  }
  return resposta;
}

export const config = {
  // Todas as telas + /api/admin; exclui demais APIs, arquivos estáticos e internos do Next
  matcher: ["/((?!api/|_next/|marca/|templates/|favicon.ico|icon.png|.*\\..*).*)", "/api/admin/:path*"],
};
