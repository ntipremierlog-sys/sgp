/**
 * Token curto (10 min) que autoriza a troca obrigatória de senha no primeiro acesso,
 * sem abrir sessão completa no sistema antes da troca.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { obterSegredoSessao } from "./sessao";

export const NOME_COOKIE_TROCA_SENHA = "sgp_troca_senha";
export const VALIDADE_TROCA_SENHA_S = 10 * 60;

function assinar(dados: string): string {
  return createHmac("sha256", obterSegredoSessao()).update(`troca:${dados}`).digest("base64url");
}

export function emitirTokenTrocaSenha(email: string): string {
  const dados = Buffer.from(JSON.stringify({ email, exp: Date.now() + VALIDADE_TROCA_SENHA_S * 1000 })).toString("base64url");
  return `${dados}.${assinar(dados)}`;
}

export function lerTokenTrocaSenha(token: string | undefined): string | null {
  if (!token) return null;
  const [dados, assinatura] = token.split(".");
  if (!dados || !assinatura) return null;
  const esperada = Buffer.from(assinar(dados));
  const recebida = Buffer.from(assinatura);
  if (esperada.length !== recebida.length || !timingSafeEqual(esperada, recebida)) return null;
  try {
    const { email, exp } = JSON.parse(Buffer.from(dados, "base64url").toString("utf-8"));
    if (typeof email !== "string" || typeof exp !== "number" || exp < Date.now()) return null;
    return email;
  } catch {
    return null;
  }
}
