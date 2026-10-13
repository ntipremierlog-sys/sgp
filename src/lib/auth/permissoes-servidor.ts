/**
 * Armazenamento das liberações de módulos por perfil (somente servidor).
 *
 * - Persistência: `.sgp-dados/permissoes.json` (fora do git) quando o sistema de arquivos
 *   permite escrita; em ambiente serverless usa /tmp; em último caso, memória do processo.
 * - Toda verificação no servidor deve usar `canServidor`, que carrega as personalizações
 *   antes de consultar a matriz.
 */
import fs from "fs";
import path from "path";
import {
  can,
  celulaEditavel,
  definirPersonalizacoesPermissao,
  MATRIZ_PERMISSOES,
  PERFIS_CONFIGURAVEIS,
  recursoPossuiExportacao,
  type PersonalizacoesPermissao,
} from "./permissoes";
import type { Acao, Recurso, UsuarioSessao } from "./tipos";

interface ArmazemPermissoes {
  personalizacoes: PersonalizacoesPermissao;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
}

const globalPerm = globalThis as unknown as { __sgpPermissoes?: ArmazemPermissoes };

function obterArquivo(): string {
  if (process.env.NODE_ENV === "test") {
    return path.resolve(process.cwd(), ".sgp-dados", "permissoes-test.json");
  }
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return path.join("/tmp", "sgp-permissoes.json");
  }
  return path.resolve(process.cwd(), ".sgp-dados", "permissoes.json");
}

export function carregarArmazemPermissoes(): ArmazemPermissoes {
  if (!globalPerm.__sgpPermissoes) {
    const armazem: ArmazemPermissoes = { personalizacoes: {}, atualizadoEm: null, atualizadoPor: null };
    try {
      const arquivo = obterArquivo();
      if (process.env.NODE_ENV !== "test" && fs.existsSync(arquivo)) {
        const bruto = JSON.parse(fs.readFileSync(arquivo, "utf-8"));
        if (bruto && typeof bruto === "object") {
          armazem.personalizacoes = sanitizarPersonalizacoes(bruto.personalizacoes);
          armazem.atualizadoEm = typeof bruto.atualizadoEm === "string" ? bruto.atualizadoEm : null;
          armazem.atualizadoPor = typeof bruto.atualizadoPor === "string" ? bruto.atualizadoPor : null;
        }
      }
    } catch (err) {
      console.warn("Aviso: falha ao ler permissões personalizadas; usando matriz padrão.", err);
    }
    globalPerm.__sgpPermissoes = armazem;
  }
  definirPersonalizacoesPermissao(globalPerm.__sgpPermissoes.personalizacoes);
  return globalPerm.__sgpPermissoes;
}

/** Mantém apenas células válidas e editáveis (impede gravar acesso a módulos exclusivos do admin). */
export function sanitizarPersonalizacoes(entrada: unknown): PersonalizacoesPermissao {
  const saida: PersonalizacoesPermissao = {};
  if (!entrada || typeof entrada !== "object") return saida;
  const obj = entrada as Record<string, Record<string, { ler?: unknown; exportar?: unknown }>>;
  for (const regra of MATRIZ_PERMISSOES) {
    const porPerfil = obj[regra.recurso];
    if (!porPerfil || typeof porPerfil !== "object") continue;
    for (const perfil of PERFIS_CONFIGURAVEIS) {
      const cel = porPerfil[perfil];
      if (!cel || typeof cel !== "object") continue;
      if (!celulaEditavel(regra.recurso, perfil)) continue;
      const ler = cel.ler === true;
      const exportar = ler && cel.exportar === true && recursoPossuiExportacao(regra.recurso);
      (saida[regra.recurso] ||= {})[perfil] = { ler, exportar };
    }
  }
  return saida;
}

export function salvarPersonalizacoes(entrada: unknown, executor: UsuarioSessao): ArmazemPermissoes {
  const armazem: ArmazemPermissoes = {
    personalizacoes: sanitizarPersonalizacoes(entrada),
    atualizadoEm: new Date().toISOString(),
    atualizadoPor: executor.nome || executor.email,
  };
  globalPerm.__sgpPermissoes = armazem;
  definirPersonalizacoesPermissao(armazem.personalizacoes);
  if (process.env.NODE_ENV !== "test") {
    try {
      const arquivo = obterArquivo();
      fs.mkdirSync(path.dirname(arquivo), { recursive: true });
      fs.writeFileSync(arquivo, JSON.stringify(armazem, null, 2));
    } catch (err) {
      console.warn("Aviso: falha ao persistir permissões em disco (mantidas em memória).", err);
    }
  }
  return armazem;
}

/** Verificação de permissão no servidor, sempre com as personalizações atualizadas. */
export function canServidor(usuario: UsuarioSessao | null | undefined, acao: Acao, recurso: Recurso): boolean {
  carregarArmazemPermissoes();
  return can(usuario, acao, recurso);
}
