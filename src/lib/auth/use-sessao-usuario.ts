"use client";

import { useEffect, useState } from "react";
import { definirSessaoAtiva } from "@/lib/dados/estado-operacional";

export interface SessaoUsuarioCliente {
  id?: string;
  nome: string;
  email?: string;
  perfil: string;
}

/**
 * Obtém a sessão REAL do usuário autenticado (via /api/auth).
 *
 * Regras de segurança (LGPD):
 * - Enquanto a sessão carrega, ou se falhar, `perfil` é `null`.
 *   As funções de exibição tratam `null` como perfil SEM acesso a dados
 *   pessoais (fail-closed). Nunca se presume perfil Premier.
 * - A sessão também é registrada no módulo de estado, para que a trilha de
 *   auditoria grave o usuário real em vez de um usuário fixo.
 */
export function useSessaoUsuario() {
  const [sessao, setSessao] = useState<SessaoUsuarioCliente | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;
    fetch("/api/auth", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((dados) => {
        if (!ativo) return;
        const usuario = dados?.autenticado ? dados.usuario : null;
        if (usuario && usuario.perfil) {
          const s: SessaoUsuarioCliente = {
            id: usuario.id,
            nome: usuario.nome || usuario.email || "Usuário",
            email: usuario.email,
            perfil: String(usuario.perfil),
          };
          setSessao(s);
          definirSessaoAtiva({ id: s.id, nome: s.nome, perfil: s.perfil });
        } else {
          setSessao(null);
          definirSessaoAtiva(null);
        }
      })
      .catch(() => {
        if (!ativo) return;
        setSessao(null);
        definirSessaoAtiva(null);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, []);

  return { sessao, perfil: sessao?.perfil ?? null, carregando };
}
