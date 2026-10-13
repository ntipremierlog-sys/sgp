"use client";

import { useCallback, useEffect, useState } from "react";
import { can, definirPersonalizacoesPermissao, type PersonalizacoesPermissao } from "./permissoes";
import type { Acao, Recurso, UsuarioSessao } from "./tipos";

/** Evento disparado quando o administrador grava novas liberações. */
export const EVENTO_PERMISSOES_ATUALIZADAS = "sgp-permissoes-atualizadas";

let requisicaoEmAndamento: Promise<UsuarioSessao | null> | null = null;

/**
 * Busca a sessão e as liberações vigentes em /api/auth (deduplicado entre componentes)
 * e aplica as liberações ao módulo de permissões do cliente.
 */
export function carregarSessaoComPermissoes(forcar = false): Promise<UsuarioSessao | null> {
  if (requisicaoEmAndamento && !forcar) return requisicaoEmAndamento;
  requisicaoEmAndamento = fetch("/api/auth", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((dados) => {
      definirPersonalizacoesPermissao((dados?.permissoes as PersonalizacoesPermissao) || {});
      return dados?.autenticado && dados.usuario ? (dados.usuario as UsuarioSessao) : null;
    })
    .catch(() => null)
    .finally(() => {
      // Libera para a próxima navegação buscar novamente (mudanças de perfil/liberação)
      setTimeout(() => {
        requisicaoEmAndamento = null;
      }, 0);
    });
  return requisicaoEmAndamento;
}

/**
 * Sessão + verificação de permissão no cliente (fail-closed: sem sessão, nada é liberado).
 * Reage a alterações de liberação feitas na Administração.
 */
export function usePermissoes() {
  const [sessao, setSessao] = useState<UsuarioSessao | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;
    const atualizar = () => {
      carregarSessaoComPermissoes(true).then((s) => {
        if (!ativo) return;
        setSessao(s);
        setCarregando(false);
        setVersao((v) => v + 1);
      });
    };
    atualizar();
    window.addEventListener(EVENTO_PERMISSOES_ATUALIZADAS, atualizar);
    window.addEventListener("sgp-sessao-alterada", atualizar);
    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_PERMISSOES_ATUALIZADAS, atualizar);
      window.removeEventListener("sgp-sessao-alterada", atualizar);
    };
  }, []);

  const pode = useCallback(
    (acao: Acao, recurso: Recurso) => can(sessao, acao, recurso),
    // versao força recálculo quando as liberações mudam
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessao, versao]
  );

  return { sessao, carregando, pode };
}
