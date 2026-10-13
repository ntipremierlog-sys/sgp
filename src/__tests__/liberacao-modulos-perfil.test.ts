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
      GLOSA_FINANCEIRA: { AUDITOR: { ler: true, exportar: true } },
    });
    expect(can(usuario("PETROBRAS_FISCAL"), "LER", "RELATORIOS")).toBe(true);
    expect(can(usuario("PETROBRAS_FISCAL"), "EXPORTAR", "RELATORIOS")).toBe(false);
    expect(can(usuario("AUDITOR"), "EXPORTAR", "GLOSA_FINANCEIRA")).toBe(true);
  });

  it("Gestor de Contrato herda a liberação do Gestor Premier", () => {
    definirPersonalizacoesPermissao({ POSTOS: { PREMIER_GESTOR: { ler: false, exportar: false } } });
    expect(can(usuario("PREMIER_GESTOR_CONTRATO"), "LER", "POSTOS")).toBe(false);
  });

  it("Administrador e módulos exclusivos não podem ser alterados", () => {
    definirPersonalizacoesPermissao({
      PAINEL: { PREMIER_ADMIN: { ler: false, exportar: false } },
      ADMINISTRACAO: { PREMIER_GESTOR: { ler: true, exportar: false } },
    });
    expect(can(usuario("PREMIER_ADMIN"), "LER", "PAINEL")).toBe(true);
    expect(can(usuario("PREMIER_GESTOR"), "LER", "ADMINISTRACAO")).toBe(false);
    expect(celulaEditavel("ADMINISTRACAO", "PREMIER_GESTOR")).toBe(false);
    expect(celulaEditavel("PAINEL", "PREMIER_ADMIN")).toBe(false);
    expect(celulaEditavel("PAINEL", "PETROBRAS_FISCAL")).toBe(true);
  });

  it("usuário inativo ou sem perfil nunca tem acesso", () => {
    expect(can(usuario("PREMIER_GESTOR", "INATIVO"), "LER", "PAINEL")).toBe(false);
    expect(perfilPode(null, "LER", "PAINEL")).toBe(false);
  });

  it("sanitização descarta células bloqueadas, valores inválidos e exportar sem visualizar", () => {
    const s = sanitizarPersonalizacoes({
      ADMINISTRACAO: { PREMIER_GESTOR: { ler: true, exportar: true } },
      PAINEL: { PREMIER_ADMIN: { ler: false }, PETROBRAS_FISCAL: { ler: false, exportar: true } },
      APONTAMENTOS: { AUDITOR: { ler: true, exportar: true } }, // m\u00f3dulo sem exporta\u00e7\u00e3o
      INEXISTENTE: { AUDITOR: { ler: true } },
    });
    expect(s.ADMINISTRACAO).toBeUndefined();
    expect(s.PAINEL?.PREMIER_ADMIN).toBeUndefined();
    expect(s.PAINEL?.PETROBRAS_FISCAL).toEqual({ ler: false, exportar: false });
    expect(s.APONTAMENTOS?.AUDITOR).toEqual({ ler: true, exportar: false });
    expect((s as Record<string, unknown>).INEXISTENTE).toBeUndefined();
  });

  it("canServidor aplica as liberações salvas", () => {
    salvarPersonalizacoes({ CONFORMIDADE: { PETROBRAS_GESTOR: { ler: false, exportar: false } } }, usuario("PREMIER_ADMIN"));
    expect(canServidor(usuario("PETROBRAS_GESTOR"), "LER", "CONFORMIDADE")).toBe(false);
    salvarPersonalizacoes({}, usuario("PREMIER_ADMIN"));
    expect(canServidor(usuario("PETROBRAS_GESTOR"), "LER", "CONFORMIDADE")).toBe(true);
  });

  it("liberação efetiva usada pela tela reflete um rascunho sem alterar o estado em vigor", () => {
    const rascunho = { PAINEL: { AUDITOR: { ler: false, exportar: false } } };
    expect(obterLiberacaoEfetiva("PAINEL", "AUDITOR", rascunho)).toEqual({ ler: false, exportar: false });
    expect(obterLiberacaoEfetiva("PAINEL", "AUDITOR")).toEqual({ ler: true, exportar: true });
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
