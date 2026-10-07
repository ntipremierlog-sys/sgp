import {
  PerfilUsuario,
  UsuarioSessao,
  Acao,
  Recurso,
} from "./tipos";

/**
 * Matriz estática de permissões por perfil (RBAC)
 */
export interface RegraPermissao {
  recurso: Recurso;
  nomeRecurso: string;
  acoes: Record<PerfilUsuario, Acao[]>;
  descricao: string;
}

export const MATRIZ_PERMISSOES: RegraPermissao[] = [
  {
    recurso: "PAINEL",
    nomeRecurso: "Painel Geral e Indicadores",
    descricao: "Visualização dos KPIs contratuais, cobertura agora e evolução",
    acoes: {
      PREMIER_ADMIN: ["LER", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER"],
      PREMIER_RH: ["LER"],
      PETROBRAS_FISCAL: ["LER"],
      PETROBRAS_GESTOR: ["LER"],
      AUDITOR: ["LER", "EXPORTAR"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "MAPA_OCUPACAO",
    nomeRecurso: "Mapa de Cobertura dos Postos",
    descricao: "Grade diária de alocação de profissionais nos postos contratuais",
    acoes: {
      PREMIER_ADMIN: ["LER", "EDITAR", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "EDITAR", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "EDITAR", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER"],
      PREMIER_RH: ["LER"],
      PETROBRAS_FISCAL: ["LER"],
      PETROBRAS_GESTOR: ["LER"],
      AUDITOR: ["LER", "EXPORTAR"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "POSTOS",
    nomeRecurso: "Postos de Trabalho (Anexo 1-A)",
    descricao: "Catálogo de postos homologados da Petrobras",
    acoes: {
      PREMIER_ADMIN: ["LER", "CRIAR", "EDITAR", "EXCLUIR", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER"],
      PREMIER_RH: ["LER"],
      PETROBRAS_FISCAL: ["LER"],
      PETROBRAS_GESTOR: ["LER"],
      AUDITOR: ["LER"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "PROFISSIONAIS",
    nomeRecurso: "Profissionais e Colaboradores",
    descricao: "Cadastro de colaboradores alocados no contrato",
    acoes: {
      PREMIER_ADMIN: ["LER", "CRIAR", "EDITAR", "EXCLUIR", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER"],
      PREMIER_RH: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PETROBRAS_FISCAL: ["LER"],
      PETROBRAS_GESTOR: ["LER"],
      AUDITOR: ["LER"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "OCORRENCIAS",
    nomeRecurso: "Registro de Ocorrências (Ausências/Férias)",
    descricao: "Lançamento e justificativa de faltas, férias e afastamentos",
    acoes: {
      PREMIER_ADMIN: ["LER", "CRIAR", "EDITAR", "EXCLUIR", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER", "CRIAR"],
      PREMIER_RH: ["LER", "CRIAR", "EDITAR"],
      PETROBRAS_FISCAL: ["LER"],
      PETROBRAS_GESTOR: ["LER"],
      AUDITOR: ["LER"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "COBERTURAS",
    nomeRecurso: "Gestão de Coberturas e Substituições",
    descricao: "Designação de substitutos fixos ou volantes para postos",
    acoes: {
      PREMIER_ADMIN: ["LER", "CRIAR", "EDITAR", "EXCLUIR", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "CRIAR", "EDITAR", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER", "CRIAR"],
      PREMIER_RH: ["LER"],
      PETROBRAS_FISCAL: ["LER"],
      PETROBRAS_GESTOR: ["LER"],
      AUDITOR: ["LER"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "APONTAMENTOS",
    nomeRecurso: "Apontamentos da Fiscalização Petrobras",
    descricao: "Comunicação formal e chamados de fiscalização contratual",
    acoes: {
      PREMIER_ADMIN: ["LER", "EDITAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "EDITAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "EDITAR"],
      PREMIER_SUPERVISOR: ["LER", "EDITAR"],
      PREMIER_RH: ["LER"],
      PETROBRAS_FISCAL: ["LER", "CRIAR", "EDITAR"],
      PETROBRAS_GESTOR: ["LER", "CRIAR"],
      AUDITOR: ["LER"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "RELATORIOS",
    nomeRecurso: "Relatórios e Memória de Medição",
    descricao: "Consolidação mensal e apuração para faturamento",
    acoes: {
      PREMIER_ADMIN: ["LER", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER"],
      PREMIER_RH: ["LER"],
      PETROBRAS_FISCAL: ["LER", "EXPORTAR"],
      PETROBRAS_GESTOR: ["LER", "EXPORTAR"],
      AUDITOR: ["LER", "EXPORTAR"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "CONFORMIDADE",
    nomeRecurso: "Conformidade Contratual e LGPD",
    descricao: "Painel de requisitos contratuais e governança",
    acoes: {
      PREMIER_ADMIN: ["LER", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "EXPORTAR"],
      PREMIER_SUPERVISOR: ["LER"],
      PREMIER_RH: ["LER"],
      PETROBRAS_FISCAL: ["LER"],
      PETROBRAS_GESTOR: ["LER"],
      AUDITOR: ["LER", "EXPORTAR"],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "AUDITORIA",
    nomeRecurso: "Trilha de Auditoria Geral",
    descricao: "Log imutável de transações do sistema",
    acoes: {
      PREMIER_ADMIN: ["LER", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: [],
      PREMIER_GESTOR_CONTRATO: [],
      PREMIER_SUPERVISOR: [],
      PREMIER_RH: [],
      PETROBRAS_FISCAL: [],
      PETROBRAS_GESTOR: [],
      AUDITOR: [],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "IMPORTACOES",
    nomeRecurso: "Importação de Dados (RHID / RM)",
    descricao: "Carga automatizada de batidas de ponto e folha",
    acoes: {
      PREMIER_ADMIN: ["LER", "CRIAR", "GERENCIAR"],
      PREMIER_GESTOR: [],
      PREMIER_GESTOR_CONTRATO: [],
      PREMIER_SUPERVISOR: [],
      PREMIER_RH: [],
      PETROBRAS_FISCAL: [],
      PETROBRAS_GESTOR: [],
      AUDITOR: [],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "ADMINISTRACAO",
    nomeRecurso: "Área de Administração e Governança",
    descricao: "Gestão de usuários, perfis, vínculos territoriais e segurança",
    acoes: {
      PREMIER_ADMIN: ["LER", "CRIAR", "EDITAR", "EXCLUIR", "GERENCIAR"],
      PREMIER_GESTOR: [],
      PREMIER_GESTOR_CONTRATO: [],
      PREMIER_SUPERVISOR: [],
      PREMIER_RH: [],
      PETROBRAS_FISCAL: [],
      PETROBRAS_GESTOR: [],
      AUDITOR: [],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "PARAMETROS_CONTRATO",
    nomeRecurso: "Parâmetros Contratuais (Glosa e Prazos)",
    descricao: "Configuração do fator de glosa e prazo de fechamento",
    acoes: {
      PREMIER_ADMIN: ["LER", "EDITAR", "GERENCIAR"],
      PREMIER_GESTOR: [],
      PREMIER_GESTOR_CONTRATO: [],
      PREMIER_SUPERVISOR: [],
      PREMIER_RH: [],
      PETROBRAS_FISCAL: [],
      PETROBRAS_GESTOR: [],
      AUDITOR: [],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "CONCILIACAO_SIFAC",
    nomeRecurso: "Conciliação RM × SIFAC",
    descricao: "Identificação e tratamento prévio de divergências entre cadastro RM e alocados SIFAC",
    acoes: {
      PREMIER_ADMIN: ["LER", "EDITAR", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: [],
      PREMIER_GESTOR_CONTRATO: [],
      PREMIER_SUPERVISOR: [],
      PREMIER_RH: [],
      PETROBRAS_FISCAL: [],
      PETROBRAS_GESTOR: [],
      AUDITOR: [],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "DADOS_SENSIVEIS_LGPD",
    nomeRecurso: "Dados Médicos Pessoais Sensíveis (CID-10)",
    descricao: "Acesso estrito a diagnósticos médicos e motivos confidenciais de saúde",
    acoes: {
      PREMIER_ADMIN: ["LER"],
      PREMIER_GESTOR: [],
      PREMIER_GESTOR_CONTRATO: [],
      PREMIER_SUPERVISOR: [],
      PREMIER_RH: ["LER", "EDITAR"],
      PETROBRAS_FISCAL: [],
      PETROBRAS_GESTOR: [],
      AUDITOR: [],
      PENDENTE_PERFIL: [],
    },
  },
  {
    recurso: "GLOSA_FINANCEIRA",
    nomeRecurso: "Impacto Financeiro de Glosa e Memória Interna",
    descricao: "Valores financeiros em R$ de desconto por ausências descobertas",
    acoes: {
      PREMIER_ADMIN: ["LER", "EXPORTAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "EXPORTAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "EXPORTAR"],
      PREMIER_SUPERVISOR: [],
      PREMIER_RH: [],
      PETROBRAS_FISCAL: [],
      PETROBRAS_GESTOR: [],
      AUDITOR: [],
      PENDENTE_PERFIL: [],
    },
  },
];

/**
 * Função central de verificação de permissão
 * Ex: can(usuario, 'LER', 'ADMINISTRACAO')
 */
export function can(
  usuario: UsuarioSessao | null | undefined,
  acao: Acao,
  recurso: Recurso
): boolean {
  if (!usuario) return false;
  if (usuario.status !== "ATIVO") return false;

  // Normalização de perfil gestor
  let perfil = usuario.perfil;
  if (perfil === "PREMIER_GESTOR_CONTRATO") {
    perfil = "PREMIER_GESTOR";
  }

  const regra = MATRIZ_PERMISSOES.find((r) => r.recurso === recurso);
  if (!regra) return false;

  const acoesPermitidas = regra.acoes[perfil] || [];
  return acoesPermitidas.includes(acao) || acoesPermitidas.includes("GERENCIAR");
}

/**
 * Verifica se o usuário tem permissão para visualizar/acessar uma unidade/base
 */
export function usuarioTemAcessoBase(
  usuario: UsuarioSessao | null | undefined,
  baseId: string | null | undefined
): boolean {
  if (!usuario) return false;
  if (usuario.status !== "ATIVO") return false;

  // Se não foi informada base específica ou busca todas
  if (!baseId || baseId === "TODAS" || baseId.trim() === "") {
    return true;
  }

  // Se o usuário tem acesso irrestrito ("TODAS")
  if (usuario.basesVinculadas.includes("TODAS")) {
    return true;
  }

  // Comparações com normalização
  const normalizado = baseId.trim().toUpperCase();
  return usuario.basesVinculadas.some((b) => {
    const bNorm = b.trim().toUpperCase();
    return bNorm === normalizado || normalizado.includes(bNorm) || bNorm.includes(normalizado);
  });
}

/**
 * Labels amigáveis para perfis
 */
export const NOMES_PERFIS: Record<PerfilUsuario, string> = {
  PREMIER_ADMIN: "Administrador Premier",
  PREMIER_GESTOR: "Gestor Premier",
  PREMIER_GESTOR_CONTRATO: "Gestor Premier",
  PREMIER_SUPERVISOR: "Supervisor Premier",
  PREMIER_RH: "Recursos Humanos Premier",
  PETROBRAS_FISCAL: "Fiscal Petrobras",
  PETROBRAS_GESTOR: "Gestor Petrobras",
  AUDITOR: "Auditor",
  PENDENTE_PERFIL: "Pendente de Atribuição",
};
