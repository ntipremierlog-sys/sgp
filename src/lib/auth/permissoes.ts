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
    nomeRecurso: "Apontamentos e Observações (Petrobras e Premier)",
    descricao: "Apontamentos da fiscalização e observações operacionais da contratada",
    acoes: {
      PREMIER_ADMIN: ["LER", "CRIAR", "EDITAR", "GERENCIAR"],
      PREMIER_GESTOR: ["LER", "CRIAR", "EDITAR"],
      PREMIER_GESTOR_CONTRATO: ["LER", "CRIAR", "EDITAR"],
      PREMIER_SUPERVISOR: ["LER", "CRIAR", "EDITAR"],
      PREMIER_RH: ["LER", "CRIAR"],
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
 * Personalizações de Visualizar/Exportar definidas pelo Administrador na tela
 * Administração → Permissões. Sobrepõem a matriz padrão acima.
 * Estrutura: { [recurso]: { [perfil]: { ler, exportar } } }
 */
export interface LiberacaoModulo {
  ler: boolean;
  exportar: boolean;
}
export type PersonalizacoesPermissao = Partial<Record<Recurso, Partial<Record<PerfilUsuario, LiberacaoModulo>>>>;

/** Perfis exibidos na tela de liberação (GESTOR_CONTRATO espelha GESTOR; PENDENTE nunca tem acesso). */
export const PERFIS_CONFIGURAVEIS: PerfilUsuario[] = [
  "PREMIER_ADMIN",
  "PREMIER_RH",
  "PREMIER_SUPERVISOR",
  "PREMIER_GESTOR",
  "PETROBRAS_FISCAL",
  "PETROBRAS_GESTOR",
];

/** Módulos restritos ao Administrador por regra do sistema (o middleware também os bloqueia). */
export const RECURSOS_EXCLUSIVOS_ADMIN: Recurso[] = ["ADMINISTRACAO", "PARAMETROS_CONTRATO"];

/** Recursos que não são telas, mas controlam dados exibidos/exportados dentro delas. */
export const RECURSOS_DADOS_SENSIVEIS: Recurso[] = ["GLOSA_FINANCEIRA", "DADOS_SENSIVEIS_LGPD"];

let personalizacoesAtuais: PersonalizacoesPermissao = {};

/** Substitui as personalizações em vigor (cliente: vindas de /api/auth; servidor: do armazenamento). */
export function definirPersonalizacoesPermissao(p: PersonalizacoesPermissao | null | undefined): void {
  personalizacoesAtuais = p && typeof p === "object" ? p : {};
}

export function obterPersonalizacoesPermissao(): PersonalizacoesPermissao {
  return personalizacoesAtuais;
}

function normalizarPerfil(perfil: PerfilUsuario): PerfilUsuario {
  return perfil === "PREMIER_GESTOR_CONTRATO" ? "PREMIER_GESTOR" : perfil;
}

/** Indica se a célula perfil × módulo pode ser alterada na tela de liberação. */
export function celulaEditavel(_recurso: Recurso, perfil: PerfilUsuario): boolean {
  const p = normalizarPerfil(perfil);
  if (p === "PENDENTE_PERFIL") return false;
  return true;
}

/** O módulo possui ação de exportação em algum perfil da matriz padrão. */
export function recursoPossuiExportacao(_recurso: Recurso): boolean {
  return true;
}

/**
 * Ações efetivas do perfil no recurso: matriz padrão + personalização do administrador.
 * - Sem "Visualizar" o perfil perde todas as ações do módulo.
 * - "Exportar" só vale junto com "Visualizar".
 * - Demais ações (criar/editar/excluir) seguem a matriz padrão.
 */
export function obterAcoesEfetivas(
  recurso: Recurso,
  perfil: PerfilUsuario,
  personalizacoes: PersonalizacoesPermissao = personalizacoesAtuais
): Acao[] {
  const p = normalizarPerfil(perfil);
  const regra = MATRIZ_PERMISSOES.find((r) => r.recurso === recurso);
  if (!regra) return [];
  const padrao = regra.acoes[p] || [];
  if (!celulaEditavel(recurso, p)) return padrao;

  const ov = personalizacoes[recurso]?.[p];
  if (!ov) return padrao;
  if (!ov.ler) return [];

  const acoes = new Set<Acao>(padrao.filter((a) => a !== "EXPORTAR"));
  acoes.add("LER");
  if (ov.exportar && recursoPossuiExportacao(recurso)) acoes.add("EXPORTAR");
  return Array.from(acoes);
}

/** Liberação efetiva (Visualizar/Exportar) — usada para montar a tela de administração. */
export function obterLiberacaoEfetiva(
  recurso: Recurso,
  perfil: PerfilUsuario,
  personalizacoes: PersonalizacoesPermissao = personalizacoesAtuais
): LiberacaoModulo {
  const p = normalizarPerfil(perfil);
  const ov = personalizacoes[recurso]?.[p];
  if (ov && typeof ov.ler === "boolean") {
    return {
      ler: ov.ler,
      exportar: ov.ler && ov.exportar === true,
    };
  }
  const acoes = obterAcoesEfetivas(recurso, perfil, personalizacoes);
  const gerenciar = acoes.includes("GERENCIAR");
  return {
    ler: gerenciar || acoes.includes("LER"),
    exportar: gerenciar || acoes.includes("EXPORTAR"),
  };
}

/** Liberação da matriz padrão (sem personalizações) — usada no botão "Restaurar padrão". */
export function obterLiberacaoPadrao(recurso: Recurso, perfil: PerfilUsuario): LiberacaoModulo {
  const regra = MATRIZ_PERMISSOES.find((r) => r.recurso === recurso);
  const acoes = regra?.acoes[normalizarPerfil(perfil)] || [];
  const gerenciar = acoes.includes("GERENCIAR");
  return {
    ler: gerenciar || acoes.includes("LER"),
    exportar: gerenciar || acoes.includes("EXPORTAR"),
  };
}

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
  return perfilPode(usuario.perfil, acao, recurso);
}

/** Verificação por perfil (para telas que só conhecem o perfil ativo). */
export function perfilPode(perfil: string | null | undefined, acao: Acao, recurso: Recurso): boolean {
  if (!perfil) return false;
  const acoesPermitidas = obterAcoesEfetivas(recurso, perfil as PerfilUsuario);
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
  PREMIER_RH: "RH Premier",
  PREMIER_SUPERVISOR: "Preposto Premier",
  PREMIER_GESTOR: "Gerente Premier",
  PREMIER_GESTOR_CONTRATO: "Gerente Premier",
  PETROBRAS_FISCAL: "Fiscal Petrobras",
  PETROBRAS_GESTOR: "Gestor Petrobras",
  AUDITOR: "Auditor Externo",
  PENDENTE_PERFIL: "Pendente de Atribuição",
};
