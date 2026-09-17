import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Proteção de rotas da Administração: /admin e /api/admin
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const sessionCookie = request.cookies.get("sgp_session_token")?.value;

    let perfilUsuario = "PREMIER_ADMIN"; // Fallback apenas para dev local sem login
    let statusUsuario = "ATIVO";

    if (sessionCookie) {
      try {
        const jsonStr = atob(sessionCookie);
        const payload = JSON.parse(jsonStr);
        // Em um token codificado, podemos ter dados ou id.
        // Se o token contém payload com perfil, ou se é apenas o id,
        // garantimos a validação aqui.
        if (payload && payload.perfil) {
          perfilUsuario = payload.perfil;
          statusUsuario = payload.status || "ATIVO";
        }
      } catch {
        // Token corrompido
        perfilUsuario = "DESCONHECIDO";
        statusUsuario = "INATIVO";
      }
    } else if (process.env.NODE_ENV === "production") {
      // Em produção, sem cookie é terminantemente negado
      perfilUsuario = "ANONIMO";
      statusUsuario = "INATIVO";
    }

    // Validação de Perfil e Status
    const ehAdmin = perfilUsuario === "PREMIER_ADMIN";
    const ehAtivo = statusUsuario === "ATIVO";

    if (!ehAdmin || !ehAtivo) {
      // Para chamadas de API, retorna JSON 403 Forbidden
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          {
            sucesso: false,
            erro: "Acesso não permitido. Módulo restrito exclusivamente ao perfil Administrador Premier.",
          },
          { status: 403 }
        );
      }

      // Para páginas web, redireciona para a tela segura de Acesso Negado sem vazamento de dados
      const urlAcessoNegado = new URL("/acesso-negado", request.url);
      return NextResponse.redirect(urlAcessoNegado);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
