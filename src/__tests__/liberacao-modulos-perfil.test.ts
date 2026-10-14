import { describe, it, expect, beforeEach } from "vitest";
import {
  can,
  celulaEditavel,
  definirPersonalizacoesPermissao,
  obterLiberacaoEfetiva,
  perfilPode,
} from "@/lib/auth/permissoes";
import { sanitizarPersonalizacoes, salvarPersonalizacoes, canServidor } from "@/lib/auth/permissoes-servidor";
import { recursoDaRota } from "@/lib/auth/rotas-modulos";
import type { UsuarioSessao, PerfilUsuario } from "@/lib/auth/tipos";

function usuario(perfil: PerfilUsuario, status: UsuarioSessao["status"] = "ATIVO"): UsuarioSessao {
  return {
    id: `u-${perfil}`,
    nome: perfil,
    email: `${perfil.toLowerCase()}@teste`,
    empresa: "Premier Logistics",
    perfil,
    status,
    tipoConta: "LOCAL",
    basesVinculadas: ["TODAS"],
  };
}

describe("Liberação de módulos por perfil (Administração → Permissões)", () => {
  beforeEach(() => definirPersonalizacoesPermissao({}));

  it("sem personalizações, segue a matriz padrão", () => {
    expect(can(usuario("PETROBRAS_FISCAL"), "LER", "PAINEL")).toBe(true);
    expect(can(usuario("PETROBRAS_FISCAL"), "LER", "GLOSA_FINANCEIRA")).toBe(false);
    expect(can(usuario("PREMIER_GESTOR"), "EXPORTAR", "RELATORIOS")).toBe(true);
  });

  it("retirar Visualizar bloqueia o módulo inteiro (inclusive criar/editar)", () => {
    definirPersonalizacoesPermissao({ OCORRENCIAS: { PREMIER_SUPERVISOR: { ler: false, exportar: false } } });
    const sup = usuario("PREMIER_SUPERVISOR");
    expect(can(sup, "LER", "OCORRENCIAS")).toBe(false);
    expect(can(sup, "CRIAR", "OCORRENCIAS")).toBe(false);
  });

  it("liberar Visualizar não concede criar/editar que a matriz padrão não dá", () => {
    definirPersonalizacoesPermissao({ IMPORTACOES: { PREMIER_GESTOR: { ler: true, exportar: false } } });
    const g = usuario("PREMIER_GESTOR");
    expect(can(g, "LER", "IMPORTACOES")).toBe(true);
    expect(can(g, "CRIAR", "IMPORTACOES")).toBe(false);
  });

  it("Exportar pode ser liberado ou retirado independentemente", () => {
    definirPersonalizacoesPermissao({
      RELATORIOS: { PETROBRAS_FISCAL: { ler: true, exportar: false } },
      GLOSA_FINANCEIRA: { PREMIER_GESTOR: { ler: true, exportar: true } },
    });
    expect(can(usuario("PETROBRAS_FISCAL"), "LER", "RELATORIOS")).toBe(true);
    expect(can(usuario("PETROBRAS_FISCAL"), "EXPORTAR", "RELATORIOS")).toBe(false);
    expect(can(usuario("PREMIER_GESTOR"), "EXPORTAR", "GLOSA_FINANCEIRA")).toBe(true);
  });

  it("Gestor de Contrato herda a liberação do Gestor Premier", () => {
    definirPersonalizacoesPermissao({ POSTOS: { PREMIER_GESTOR: { ler: false, exportar: false } } });
    expect(can(usuario("PREMIER_GESTOR_CONTRATO"), "LER", "POSTOS")).toBe(false);
  });

  it("Administrador pode customizar permissões de todos os perfis e módulos", () => {
    definirPersonalizacoesPermissao({
      PAINEL: { PREMIER_ADMIN: { ler: false, exportar: false } },
      ADMINISTRACAO: { PREMIER_GESTOR: { ler: true, exportar: false } },
    });
    expect(celulaEditavel("ADMINISTRACAO", "PREMIER_GESTOR")).toBe(true);
    expect(celulaEditavel("PAINEL", "PREMIER_ADMIN")).toBe(true);
    expect(celulaEditavel("PAINEL", "PETROBRAS_FISCAL")).toBe(true);
    expect(celulaEditavel("PAINEL", "PENDENTE_PERFIL")).toBe(false);
  });

  it("usuário inativo ou sem perfil nunca tem acesso", () => {
    expect(can(usuario("PREMIER_GESTOR", "INATIVO"), "LER", "PAINEL")).toBe(false);
    expect(perfilPode(null, "LER", "PAINEL")).toBe(false);
  });

  it("sanitização descarta células de perfil pendente, valores inválidos e exportar sem visualizar", () => {
    const s = sanitizarPersonalizacoes({
      ADMINISTRACAO: { PREMIER_GESTOR: { ler: true, exportar: true } },
      PAINEL: { PREMIER_ADMIN: { ler: false, exportar: true }, PETROBRAS_FISCAL: { ler: false, exportar: true } },
      PENDENTE: { PENDENTE_PERFIL: { ler: true } },
      INEXISTENTE: { PREMIER_GESTOR: { ler: true } },
    });
    expect(s.ADMINISTRACAO?.PREMIER_GESTOR).toEqual({ ler: true, exportar: true });
    expect(s.PAINEL?.PREMIER_ADMIN).toEqual({ ler: false, exportar: false });
    expect(s.PAINEL?.PETROBRAS_FISCAL).toEqual({ ler: false, exportar: false });
    expect((s as Record<string, unknown>).INEXISTENTE).toBeUndefined();
  });

  it("canServidor aplica as liberações salvas", () => {
    salvarPersonalizacoes({ CONFORMIDADE: { PETROBRAS_GESTOR: { ler: false, exportar: false } } }, usuario("PREMIER_ADMIN"));
    expect(canServidor(usuario("PETROBRAS_GESTOR"), "LER", "CONFORMIDADE")).toBe(false);
    salvarPersonalizacoes({}, usuario("PREMIER_ADMIN"));
    expect(canServidor(usuario("PETROBRAS_GESTOR"), "LER", "CONFORMIDADE")).toBe(true);
  });

  it("liberação efetiva usada pela tela reflete um rascunho sem alterar o estado em vigor", () => {
    const rascunho = { PAINEL: { PREMIER_GESTOR: { ler: false, exportar: false } } };
    expect(obterLiberacaoEfetiva("PAINEL", "PREMIER_GESTOR", rascunho)).toEqual({ ler: false, exportar: false });
    expect(obterLiberacaoEfetiva("PAINEL", "PREMIER_GESTOR")).toEqual({ ler: true, exportar: true });
  });

  it("rotas de tela são associadas ao módulo correto", () => {
    expect(recursoDaRota("/mapa-ocupacao")).toBe("MAPA_OCUPACAO");
    expect(recursoDaRota("/presenca-diaria")).toBe("MAPA_OCUPACAO");
    expect(recursoDaRota("/profissionais/123/espelho-ponto")).toBe("PROFISSIONAIS");
    expect(recursoDaRota("/painel/base/UFN-III")).toBe("PAINEL");
    expect(recursoDaRota("/postos-extra")).toBeNull();
    expect(recursoDaRota("/login")).toBeNull();
  });
});
