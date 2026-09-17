import { cookies } from "next/headers";
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

/**
 * Codifica a sessão em base64 com timestamp de integridade
 */
export function codificarTokenSessao(usuario: UsuarioSessao): string {
  const payload = {
    userId: usuario.id,
    email: usuario.email,
    perfil: usuario.perfil,
    status: usuario.status,
    basesVinculadas: usuario.basesVinculadas,
    timestamp: Date.now(),
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Decodifica o token de sessão e resolve o usuário ativo
 */
export function decodificarTokenSessao(token: string): { userId: string; email: string } | null {
  try {
    const raw = Buffer.from(token, "base64").toString("utf-8");
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
 * Obtém a sessão autenticada no servidor (Server Components, API Routes, Server Actions)
 * O perfil sempre é revalidado contra o cadastro ativo do usuário no servidor!
 * "Alterações de perfil passam a valer na próxima requisição do usuário afetado."
 * "Usuário desativado perde o acesso imediatamente."
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
    // Em modo de desenvolvimento, se não houver cookie ainda, usa o Administrador Premier inicial
    if (process.env.NODE_ENV !== "production") {
      const admin = usuarios.find((u) => u.perfil === "PREMIER_ADMIN" && u.status === "ATIVO");
      if (admin) return mapearParaSessao(admin);
      return SESSAO_PADRAO_DEV;
    }
    return null;
  }

  const decodificado = decodificarTokenSessao(token);
  if (!decodificado) return null;

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
