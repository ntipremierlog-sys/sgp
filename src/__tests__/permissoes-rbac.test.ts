import { describe, it, expect, beforeEach } from "vitest";
import { can, usuarioTemAcessoBase, MATRIZ_PERMISSOES } from "@/lib/auth/permissoes";
import { UsuarioSessao, UsuarioCadastro } from "@/lib/auth/tipos";
import {
  carregarUsuarios,
  salvarUsuarios,
  atualizarPerfilUsuario,
  alterarStatusUsuario,
  excluirUsuario,
  ehUltimoAdminAtivo,
  USUARIOS_PADRAO,
} from "@/lib/auth/usuarios";
import {
  obterParametrosContrato,
  salvarParametrosContrato,
  listarConfiguracoesPendentes,
  temConfiguracaoPendente,
} from "@/lib/auth/parametros";

describe("Motor de Permissões Server-Side (RBAC) - MOMENTO 1", () => {
  const usuarioAdmin: UsuarioSessao = {
    id: "usr-admin-01",
    nome: "Administrador Premier",
    email: "admin.sgp@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_ADMIN",
    status: "ATIVO",
    tipoConta: "LOCAL",
    basesVinculadas: ["TODAS"],
  };

  const usuarioGestor: UsuarioSessao = {
    id: "usr-gestor-01",
    nome: "Marcos Valério",
    email: "marcos.valerio@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_GESTOR",
    status: "ATIVO",
    tipoConta: "SSO_MICROSOFT",
    basesVinculadas: ["TODAS"],
  };

  const usuarioFiscal: UsuarioSessao = {
    id: "usr-fiscal-01",
    nome: "Carlos Eduardo Mendes",
    email: "carlos.mendes@petrobras.com.br",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    perfil: "PETROBRAS_FISCAL",
    status: "ATIVO",
    tipoConta: "SSO_MICROSOFT",
    basesVinculadas: ["UFN-III"],
  };

  const usuarioInativo: UsuarioSessao = {
    ...usuarioAdmin,
    id: "usr-inativo",
    status: "INATIVO",
  };

  describe("Função can()", () => {
    it("Administrador Premier deve ter acesso total a todos os módulos incluindo ADMINISTRACAO", () => {
      expect(can(usuarioAdmin, "LER", "ADMINISTRACAO")).toBe(true);
      expect(can(usuarioAdmin, "CRIAR", "ADMINISTRACAO")).toBe(true);
      expect(can(usuarioAdmin, "LER", "PARAMETROS_CONTRATO")).toBe(true);
      expect(can(usuarioAdmin, "EDITAR", "PARAMETROS_CONTRATO")).toBe(true);
      expect(can(usuarioAdmin, "LER", "PAINEL")).toBe(true);
    });

    it("Gestor Premier NÃO deve ter acesso à Administração nem a Parâmetros Contratuais", () => {
      expect(can(usuarioGestor, "LER", "ADMINISTRACAO")).toBe(false);
      expect(can(usuarioGestor, "CRIAR", "ADMINISTRACAO")).toBe(false);
      expect(can(usuarioGestor, "EDITAR", "ADMINISTRACAO")).toBe(false);
      expect(can(usuarioGestor, "LER", "PARAMETROS_CONTRATO")).toBe(false);
    });

    it("Gestor Premier deve ter acesso operacional completo às telas de negócio", () => {
      expect(can(usuarioGestor, "LER", "PAINEL")).toBe(true);
      expect(can(usuarioGestor, "LER", "MAPA_OCUPACAO")).toBe(true);
      expect(can(usuarioGestor, "CRIAR", "POSTOS")).toBe(true);
      expect(can(usuarioGestor, "CRIAR", "OCORRENCIAS")).toBe(true);
      expect(can(usuarioGestor, "CRIAR", "COBERTURAS")).toBe(true);
      expect(can(usuarioGestor, "LER", "GLOSA_FINANCEIRA")).toBe(true);
    });

    it("Fiscal Petrobras NÃO deve ter acesso à Administração, Dados Médicos Sensíveis nem Glosa", () => {
      expect(can(usuarioFiscal, "LER", "ADMINISTRACAO")).toBe(false);
      expect(can(usuarioFiscal, "LER", "PARAMETROS_CONTRATO")).toBe(false);
      expect(can(usuarioFiscal, "LER", "DADOS_SENSIVEIS_LGPD")).toBe(false);
      expect(can(usuarioFiscal, "LER", "GLOSA_FINANCEIRA")).toBe(false);
      expect(can(usuarioFiscal, "CRIAR", "POSTOS")).toBe(false);
      expect(can(usuarioFiscal, "CRIAR", "OCORRENCIAS")).toBe(false);
    });

    it("Fiscal Petrobras deve ter somente leitura das telas liberadas e permissão de criar apontamentos", () => {
      expect(can(usuarioFiscal, "LER", "PAINEL")).toBe(true);
      expect(can(usuarioFiscal, "LER", "MAPA_OCUPACAO")).toBe(true);
      expect(can(usuarioFiscal, "LER", "POSTOS")).toBe(true);
      expect(can(usuarioFiscal, "LER", "APONTAMENTOS")).toBe(true);
      expect(can(usuarioFiscal, "CRIAR", "APONTAMENTOS")).toBe(true);
    });

    it("Usuário INATIVO deve ter acesso negado a qualquer recurso", () => {
      expect(can(usuarioInativo, "LER", "PAINEL")).toBe(false);
      expect(can(usuarioInativo, "LER", "ADMINISTRACAO")).toBe(false);
      expect(can(null, "LER", "PAINEL")).toBe(false);
      expect(can(undefined, "LER", "PAINEL")).toBe(false);
    });
  });

  describe("Vínculo Territorial de Bases (usuarioTemAcessoBase)", () => {
    it("Usuário com vínculo 'TODAS' acessa qualquer base", () => {
      expect(usuarioTemAcessoBase(usuarioAdmin, "UFN-III")).toBe(true);
      expect(usuarioTemAcessoBase(usuarioAdmin, "MACAE")).toBe(true);
      expect(usuarioTemAcessoBase(usuarioAdmin, "TODAS")).toBe(true);
    });

    it("Usuário vinculado estritamente à base UFN-III não pode ver outras bases", () => {
      expect(usuarioTemAcessoBase(usuarioFiscal, "UFN-III")).toBe(true);
      expect(usuarioTemAcessoBase(usuarioFiscal, "MACAE")).toBe(false);
      expect(usuarioTemAcessoBase(usuarioFiscal, "SANTOS")).toBe(false);
    });
  });

  describe("Regras de Segurança da Administração", () => {
    beforeEach(() => {
      salvarUsuarios([...USUARIOS_PADRAO]);
    });

    it("Nenhum usuário pode alterar o próprio perfil", () => {
      expect(() => {
        atualizarPerfilUsuario(usuarioAdmin.id, "PREMIER_GESTOR", usuarioAdmin);
      }).toThrow(/próprio perfil/i);
    });

    it("Impedir remover ou rebaixar o único Administrador Premier ativo", () => {
      // Cria um segundo admin para testar que é permitido alterar quando há mais de um
      const outroAdmin: UsuarioSessao = {
        ...usuarioAdmin,
        id: "usr-admin-02",
        email: "admin2@premierlogistics.com.br",
      };

      // Tenta rebaixar o único admin existente
      expect(ehUltimoAdminAtivo(usuarioAdmin.id)).toBe(true);
      expect(() => {
        atualizarPerfilUsuario(usuarioAdmin.id, "PREMIER_GESTOR", outroAdmin);
      }).toThrow(/último Administrador Premier/i);

      expect(() => {
        alterarStatusUsuario(usuarioAdmin.id, "INATIVO", outroAdmin);
      }).toThrow(/último Administrador Premier/i);

      expect(() => {
        excluirUsuario(usuarioAdmin.id, outroAdmin);
      }).toThrow(/último Administrador Premier/i);
    });
  });

  describe("Configurações Pendentes e Parâmetros do Contrato", () => {
    it("Identifica pendências quando fatorGlosa ou prazoFechamento forem nulos", () => {
      salvarParametrosContrato({
        fatorGlosa: null,
        prazoFechamento: null,
      });

      const params = obterParametrosContrato();
      const pendencias = listarConfiguracoesPendentes(params);

      expect(pendencias.length).toBe(2);
      expect(temConfiguracaoPendente(params)).toBe(true);
      expect(pendencias.some((p) => p.campo === "fatorGlosa")).toBe(true);
      expect(pendencias.some((p) => p.campo === "prazoFechamento")).toBe(true);
    });

    it("Resolve pendências quando os parâmetros forem preenchidos", () => {
      salvarParametrosContrato({
        fatorGlosa: 1.0,
        prazoFechamento: "5º dia útil",
      });

      const params = obterParametrosContrato();
      const pendencias = listarConfiguracoesPendentes(params);

      expect(pendencias.length).toBe(0);
      expect(temConfiguracaoPendente(params)).toBe(false);
    });
  });
});
