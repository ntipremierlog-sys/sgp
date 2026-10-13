"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { recursoDaRota } from "@/lib/auth/rotas-modulos";
import { usePermissoes } from "@/lib/auth/use-permissoes";
import AcessoNegadoPage from "@/app/acesso-negado/page";

/**
 * Bloqueia a tela quando o perfil do usuário não tem liberação de "Visualizar" para o módulo
 * da rota atual (definida em Administração → Permissões). Também impede acesso por URL direta.
 */
export function GuardaModulo({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";
  const recurso = recursoDaRota(pathname);
  const { sessao, carregando, pode } = usePermissoes();

  if (!recurso) return <>{children}</>;

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-24 text-xs text-slate-500" aria-busy="true">
        Verificando permissões de acesso…
      </div>
    );
  }

  // Sem sessão o middleware já redireciona para o login; aqui apenas não exibimos o conteúdo.
  if (!sessao || !pode("LER", recurso)) {
    return <AcessoNegadoPage />;
  }

  return <>{children}</>;
}
