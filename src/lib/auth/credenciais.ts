/**
 * Credenciais de contas LOCAIS do SGP (somente servidor).
 *
 * - Senhas armazenadas como hash scrypt com sal aleatório (nunca em texto puro).
 * - Bloqueio temporário após tentativas inválidas consecutivas.
 * - Tokens de redefinição de uso único, com expiração, guardados apenas como hash SHA-256.
 * - Persistência: arquivo local `.sgp-dados/credenciais.json` (fora do git) quando o
 *   sistema de arquivos permite escrita; caso contrário, memória do processo.
 *   Em produção com banco, o destino definitivo é a coluna `usuario.senha_hash` (Prisma).
 *
 * Contas SSO (Microsoft Entra ID) não possuem senha local.
 */
import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";
import fs from "fs";
import path from "path";
import { carregarUsuarios } from "./usuarios";
import type { UsuarioCadastro } from "./tipos";
import { validarPoliticaSenha } from "./politica-senha";

export const MAX_TENTATIVAS_LOGIN = 5;
export const BLOQUEIO_LOGIN_MS = 15 * 60 * 1000; // 15 minutos
export const VALIDADE_TOKEN_REDEFINICAO_MS = 30 * 60 * 1000; // 30 minutos

interface RegistroCredencial {
  usuarioId: string;
  email: string;
  senhaHash: string;
  /** Obriga a troca no próximo acesso (senha inicial/temporária). */
  trocarSenha: boolean;
  tentativasFalhas: number;
  bloqueadoAte: number | null;
  atualizadoEm: string;
}

interface RegistroTokenRedefinicao {
  tokenHash: string;
  email: string;
  expiraEm: number;
}

interface ArmazemCredenciais {
  credenciais: Record<string, RegistroCredencial>;
  tokens: RegistroTokenRedefinicao[];
}

const ARQUIVO = path.resolve(process.cwd(), ".sgp-dados", "credenciais.json");

const globalArmazem = globalThis as unknown as { __sgpCredenciais?: ArmazemCredenciais };

function normalizarEmail(email: string): string {
  return email.trim().toLowerCase();
}

function carregarArmazem(): ArmazemCredenciais {
  if (globalArmazem.__sgpCredenciais) return globalArmazem.__sgpCredenciais;
  let armazem: ArmazemCredenciais = { credenciais: {}, tokens: [] };
  try {
    if (fs.existsSync(ARQUIVO)) {
      const bruto = JSON.parse(fs.readFileSync(ARQUIVO, "utf-8"));
      if (bruto && typeof bruto === "object" && bruto.credenciais) armazem = bruto;
    }
  } catch {
    // arquivo ilegível: segue com armazém vazio
  }
  globalArmazem.__sgpCredenciais = armazem;
  semearSenhaInicial(armazem);
  return armazem;
}

function persistir(armazem: ArmazemCredenciais) {
  globalArmazem.__sgpCredenciais = armazem;
  if (process.env.NODE_ENV === "test") return;
  try {
    fs.mkdirSync(path.dirname(ARQUIVO), { recursive: true });
    fs.writeFileSync(ARQUIVO, JSON.stringify(armazem, null, 2), "utf-8");
  } catch {
    // FS somente leitura (ex.: serverless): mantém apenas em memória
  }
}

/**
 * Senha inicial do Administrador Premier: definida por SGP_SENHA_INICIAL_ADMIN.
 * Em desenvolvimento, sem a variável, usa uma senha temporária conhecida.
 * Em ambos os casos a troca é obrigatória no primeiro acesso.
 */
export const SENHA_INICIAL_DEV = "Premier@SGP2026";

function semearSenhaInicial(armazem: ArmazemCredenciais) {
  const senhaInicial =
    process.env.SGP_SENHA_INICIAL_ADMIN || (process.env.NODE_ENV !== "production" ? SENHA_INICIAL_DEV : "");
  if (!senhaInicial) return;
  let alterou = false;
  for (const u of carregarUsuarios()) {
    if (u.perfil !== "PREMIER_ADMIN" || u.tipoConta !== "LOCAL") continue;
    const chave = normalizarEmail(u.email);
    if (armazem.credenciais[chave]) continue;
    armazem.credenciais[chave] = {
      usuarioId: u.id,
      email: chave,
      senhaHash: gerarHashSenha(senhaInicial),
      trocarSenha: true,
      tentativasFalhas: 0,
      bloqueadoAte: null,
      atualizadoEm: new Date().toISOString(),
    };
    alterou = true;
  }
  if (alterou) persistir(armazem);
}

// ---------------------------------------------------------------------------
// Hash de senha (scrypt)
// ---------------------------------------------------------------------------

export function gerarHashSenha(senha: string): string {
  const sal = randomBytes(16);
  const hash = scryptSync(senha, sal, 64);
  return `scrypt$${sal.toString("base64")}$${hash.toString("base64")}`;
}

export function conferirSenha(senha: string, senhaHash: string): boolean {
  const [alg, salB64, hashB64] = senhaHash.split("$");
  if (alg !== "scrypt" || !salB64 || !hashB64) return false;
  const esperado = Buffer.from(hashB64, "base64");
  const calculado = scryptSync(senha, Buffer.from(salB64, "base64"), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

// ---------------------------------------------------------------------------
// Política de senha (módulo puro compartilhado com a tela)
// ---------------------------------------------------------------------------

export { avaliarPoliticaSenha, validarPoliticaSenha, TAMANHO_MINIMO_SENHA } from "./politica-senha";
export type { RequisitoSenha } from "./politica-senha";

// ---------------------------------------------------------------------------
// Autenticação
// ---------------------------------------------------------------------------

export type ResultadoAutenticacao =
  | { ok: true; usuario: UsuarioCadastro; trocarSenha: boolean }
  | { ok: false; motivo: "CREDENCIAIS_INVALIDAS" | "BLOQUEADO" | "CONTA_INATIVA" | "CONTA_SSO"; bloqueadoAteMs?: number };

export function autenticarComSenha(email: string, senha: string): ResultadoAutenticacao {
  const chave = normalizarEmail(email);
  const usuario = carregarUsuarios().find((u) => normalizarEmail(u.email) === chave);
  const armazem = carregarArmazem();
  const registro = armazem.credenciais[chave];

  if (usuario && usuario.tipoConta === "SSO_MICROSOFT") return { ok: false, motivo: "CONTA_SSO" };

  if (!usuario || !registro) {
    // Custo equivalente para não revelar se o e-mail existe
    conferirSenha(senha, gerarHashSenha("x"));
    return { ok: false, motivo: "CREDENCIAIS_INVALIDAS" };
  }

  if (registro.bloqueadoAte && registro.bloqueadoAte > Date.now()) {
    return { ok: false, motivo: "BLOQUEADO", bloqueadoAteMs: registro.bloqueadoAte };
  }

  if (!conferirSenha(senha, registro.senhaHash)) {
    registro.tentativasFalhas += 1;
    if (registro.tentativasFalhas >= MAX_TENTATIVAS_LOGIN) {
      registro.bloqueadoAte = Date.now() + BLOQUEIO_LOGIN_MS;
      registro.tentativasFalhas = 0;
      persistir(armazem);
      return { ok: false, motivo: "BLOQUEADO", bloqueadoAteMs: registro.bloqueadoAte };
    }
    persistir(armazem);
    return { ok: false, motivo: "CREDENCIAIS_INVALIDAS" };
  }

  if (usuario.status !== "ATIVO") return { ok: false, motivo: "CONTA_INATIVA" };

  registro.tentativasFalhas = 0;
  registro.bloqueadoAte = null;
  persistir(armazem);
  return { ok: true, usuario, trocarSenha: registro.trocarSenha };
}

/** Define uma nova senha (após validação de política) e remove a obrigação de troca. */
export function definirSenha(email: string, novaSenha: string): { ok: true } | { ok: false; erros: string[] } {
  const chave = normalizarEmail(email);
  const usuario = carregarUsuarios().find((u) => normalizarEmail(u.email) === chave);
  if (!usuario) return { ok: false, erros: ["Usuário não encontrado."] };
  if (usuario.tipoConta === "SSO_MICROSOFT") return { ok: false, erros: ["Contas SSO utilizam a senha do Microsoft Entra ID."] };

  const erros = validarPoliticaSenha(novaSenha, chave);
  const armazem = carregarArmazem();
  const atual = armazem.credenciais[chave];
  if (atual && conferirSenha(novaSenha, atual.senhaHash)) {
    erros.push("A nova senha deve ser diferente da atual.");
  }
  if (erros.length > 0) return { ok: false, erros };

  armazem.credenciais[chave] = {
    usuarioId: usuario.id,
    email: chave,
    senhaHash: gerarHashSenha(novaSenha),
    trocarSenha: false,
    tentativasFalhas: 0,
    bloqueadoAte: null,
    atualizadoEm: new Date().toISOString(),
  };
  // Invalida tokens de redefinição pendentes desta conta
  armazem.tokens = armazem.tokens.filter((t) => t.email !== chave);
  persistir(armazem);
  return { ok: true };
}

/** Troca de senha autenticada: exige a senha atual. */
export function alterarSenha(
  email: string,
  senhaAtual: string,
  novaSenha: string
): { ok: true } | { ok: false; erros: string[] } {
  const chave = normalizarEmail(email);
  const registro = carregarArmazem().credenciais[chave];
  if (!registro || !conferirSenha(senhaAtual, registro.senhaHash)) {
    return { ok: false, erros: ["Senha atual incorreta."] };
  }
  return definirSenha(chave, novaSenha);
}

export function exigeTrocaSenha(email: string): boolean {
  return Boolean(carregarArmazem().credenciais[normalizarEmail(email)]?.trocarSenha);
}

// ---------------------------------------------------------------------------
// Esqueci minha senha
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Gera token de redefinição para contas locais ativas. Retorna null quando o e-mail
 * não existe / é SSO / está inativo — a API responde sempre a mesma mensagem genérica.
 */
export function gerarTokenRedefinicao(email: string): string | null {
  const chave = normalizarEmail(email);
  const usuario = carregarUsuarios().find((u) => normalizarEmail(u.email) === chave);
  if (!usuario || usuario.tipoConta !== "LOCAL" || usuario.status !== "ATIVO") return null;

  const armazem = carregarArmazem();
  const agora = Date.now();
  armazem.tokens = armazem.tokens.filter((t) => t.expiraEm > agora && t.email !== chave);
  const token = randomBytes(32).toString("base64url");
  armazem.tokens.push({ tokenHash: hashToken(token), email: chave, expiraEm: agora + VALIDADE_TOKEN_REDEFINICAO_MS });
  persistir(armazem);
  return token;
}

export function validarTokenRedefinicao(token: string): { ok: true; email: string } | { ok: false } {
  const armazem = carregarArmazem();
  const registro = armazem.tokens.find((t) => t.tokenHash === hashToken(token));
  if (!registro || registro.expiraEm < Date.now()) return { ok: false };
  return { ok: true, email: registro.email };
}

export function redefinirSenhaComToken(
  token: string,
  novaSenha: string
): { ok: true; email: string } | { ok: false; erros: string[] } {
  const valido = validarTokenRedefinicao(token);
  if (!valido.ok) return { ok: false, erros: ["Link de redefinição inválido ou expirado. Solicite um novo."] };
  const resultado = definirSenha(valido.email, novaSenha);
  if (!resultado.ok) return resultado;
  return { ok: true, email: valido.email };
}

/** Apenas para testes: reinicia o armazém em memória. */
export function _reiniciarArmazemCredenciaisParaTestes() {
  globalArmazem.__sgpCredenciais = undefined;
}
