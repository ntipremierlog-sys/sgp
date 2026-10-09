import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { UsuarioSessao, UsuarioCadastro } from "./tipos";
import { carregarUsuarios, USUARIOS_PADRAO } from "./usuarios";

export const NOME_COOKIE_SESSAO = "sgp_session_token";

// Sessão padrão de inicialização segura em ambiente de desenvolvimento se nenhum cookie existir
export const SESSAO_PADRAO_DEV: UsuarioSessao = {
  id: "usr-admin-01",
  nome: "Administrador Premier",
  email: "admin.sgp@premierlogistics.com.br",
  empresa: "Premier Logistics",
  perfil: "PREMIER_ADMIN",
  status: "ATIVO",
  tipoConta: "LOCAL",
  basesVinculadas: ["TODAS"],
  cargo: "Administrador de Sistemas",
  ultimoAcesso: "2026-09-17 10:15:00",
};

export const TIMEOUT_INATIVIDADE_MS = 30 * 60 * 1000; // 30 minutos de inatividade máxima

/** Validade máxima do cookie (a inatividade é controlada pelo timestamp renovado). */
export const DURACAO_COOKIE_SESSAO_S = 12 * 60 * 60; // 12 horas

/**
 * Segredo de assinatura do token. Em produção DEVE vir de NEXTAUTH_SECRET.
 * O mesmo algoritmo é reproduzido no middleware (Edge) via Web Crypto.
 */
export function obterSegredoSessao(): string {
  return process.env.NEXTAUTH_SECRET || "sgp-dev-segredo-local-nao-usar-em-producao";
}

function assinar(payloadB64: string): string {
  return createHmac("sha256", obterSegredoSessao()).update(payloadB64).digest("base64url");
}

/**
 * Codifica a sessão em base64 com timestamp de integridade e assinatura HMAC-SHA256.
 * Formato: <payload base64>.<assinatura base64url>
 */
export function codificarTokenSessao(usuario: UsuarioSessao, opcoes?: { timestamp?: number }): string {
  const payload = {
    userId: usuario.id,
    email: usuario.email,
    perfil: usuario.perfil,
    status: usuario.status,
    basesVinculadas: usuario.basesVinculadas,
    timestamp: opcoes?.timestamp ?? Date.now(),
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return `${payloadB64}.${assinar(payloadB64)}`;
}

/**
 * Decodifica o token de sessão e resolve o usuário ativo.
 * Tokens sem assinatura válida são rejeitados (impede forjar perfil no cookie).
 */
export function decodificarTokenSessao(token: string): { userId: string; email: string; perfil?: string; status?: string; timestamp?: number } | null {
  try {
    const [payloadB64, assinatura] = token.split(".");
    if (!payloadB64 || !assinatura) return null;
    const esperada = Buffer.from(assinar(payloadB64));
    const recebida = Buffer.from(assinatura);
    if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
    const raw = Buffer.from(payloadB64, "base64").toString("utf-8");
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.userId === "string") {
      return parsed;
    }
  } catch {
    // token inválido
  }
  return null;
}

/**
 * Reemite o token com timestamp atual (sessão deslizante: cada atividade renova os 30 min).
 * Retorna null se o token for inválido ou já tiver expirado.
 */
export function renovarTokenSessao(token: string): string | null {
  const estado = verificarSessaoAtiva(token);
  if (!estado.valida) return null;
  const [payloadB64] = token.split(".");
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
    payload.timestamp = Date.now();
    const novoB64 = Buffer.from(JSON.stringify(payload)).toString("base64");
    return `${novoB64}.${assinar(novoB64)}`;
  } catch {
    return null;
  }
}

/** Monta o token de sessão a partir do cadastro do usuário. */
export function tokenSessaoParaCadastro(u: UsuarioCadastro): string {
  return codificarTokenSessao(mapearParaSessao({ ...u, ultimoAcesso: new Date().toISOString() }));
}

/** Opções padrão do cookie de sessão (HTTP-Only). */
export function opcoesCookieSessao(maxAge = DURACAO_COOKIE_SESSAO_S) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/**
 * Verifica se uma sessão ainda é válida ou se expirou por inatividade
 */
export function verificarSessaoAtiva(token: string): { valida: boolean; expiradaPorInatividade: boolean } {
  const decodificado = decodificarTokenSessao(token);
  if (!decodificado) return { valida: false, expiradaPorInatividade: false };
  if (decodificado.timestamp && Date.now() - decodificado.timestamp > TIMEOUT_INATIVIDADE_MS) {
    return { valida: false, expiradaPorInatividade: true };
  }
  return { valida: true, expiradaPorInatividade: false };
}

/**
 * Obtém a sessão autenticada no servidor (Server Components, API Routes, Server Actions)
 * O perfil sempre é revalidado contra o cadastro ativo do usuário no servidor!
 * "Alterações de perfil passam a valer na próxima requisição do usuário afetado."
 * "Usuário desativado perde o acesso imediatamente."
 * "Sessão com expiração por inatividade."
 */
export async function obterSessaoServidor(): Promise<UsuarioSessao | null> {
  let token: string | undefined;

  try {
    const cookieStore = await cookies();
    token = cookieStore.get(NOME_COOKIE_SESSAO)?.value;
  } catch {
    // Em contextos sem cookies() disponível
  }

  const usuarios = carregarUsuarios();

  if (!token) {
    // Sem cookie não há sessão. Para demonstrações locais sem login, defina SGP_DEV_SEM_LOGIN=1.
    if (process.env.NODE_ENV !== "production" && process.env.SGP_DEV_SEM_LOGIN === "1") {
      const admin = usuarios.find((u) => u.perfil === "PREMIER_ADMIN" && u.status === "ATIVO");
      if (admin) return mapearParaSessao(admin);
      return SESSAO_PADRAO_DEV;
    }
    return null;
  }

  const decodificado = decodificarTokenSessao(token);
  if (!decodificado) return null;

  // Validação estrita de expiração por inatividade
  if (decodificado.timestamp && Date.now() - decodificado.timestamp > TIMEOUT_INATIVIDADE_MS) {
    return null;
  }

  // Busca o cadastro atualizado
  const usuario = usuarios.find(
    (u) => u.id === decodificado.userId || u.email.toLowerCase() === decodificado.email.toLowerCase()
  );

  if (!usuario) return null;

  // "Usuário desativado perde o acesso imediatamente."
  if (usuario.status !== "ATIVO") {
    return null;
  }

  return mapearParaSessao(usuario);
}

function mapearParaSessao(u: UsuarioCadastro): UsuarioSessao {
  return {
    id: u.id,
    nome: u.nome,
    email: u.email,
    empresa: u.empresa,
    perfil: u.perfil,
    status: u.status,
    tipoConta: u.tipoConta,
    basesVinculadas: u.basesVinculadas || ["TODAS"],
    cargo: u.cargo,
    ultimoAcesso: u.ultimoAcesso,
  };
}
