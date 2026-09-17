import {
  UsuarioCadastro,
  UsuarioSessao,
  PerfilUsuario,
  StatusUsuario,
  LogAuditoriaAdmin,
} from "./tipos";

const CHAVE_STORAGE_USUARIOS = "sgp_usuarios_v2";
const CHAVE_STORAGE_AUDITORIA_ADMIN = "sgp_auditoria_admin_v1";

export const USUARIOS_PADRAO: UsuarioCadastro[] = [
  {
    id: "usr-admin-01",
    nome: "Administrador Premier",
    email: "admin.sgp@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_ADMIN",
    status: "ATIVO",
    tipoConta: "LOCAL",
    basesVinculadas: ["TODAS"],
    cargo: "Administrador de Sistemas",
    ultimoAcesso: "2026-09-17 10:15:00",
    criadoEm: "2026-08-01T08:00:00.000Z",
    atualizadoEm: "2026-09-17T10:15:00.000Z",
    autorizadoPor: "Diretoria de Governança Premier",
    totpAtivo: true,
  },
  {
    id: "usr-gestor-01",
    nome: "Marcos Valério de Souza",
    email: "marcos.valerio@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_GESTOR",
    status: "ATIVO",
    tipoConta: "SSO_MICROSOFT",
    basesVinculadas: ["TODAS"],
    cargo: "Gestor do Contrato Petrobras",
    ultimoAcesso: "2026-09-17 09:40:00",
    criadoEm: "2026-08-05T09:00:00.000Z",
    atualizadoEm: "2026-09-15T14:30:00.000Z",
    autorizadoPor: "Administrador Premier",
    totpAtivo: true,
  },
  {
    id: "usr-fiscal-01",
    nome: "Carlos Eduardo Mendes",
    email: "carlos.mendes@petrobras.com.br",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    perfil: "PETROBRAS_FISCAL",
    status: "ATIVO",
    tipoConta: "SSO_MICROSOFT",
    basesVinculadas: ["UFN-III"],
    cargo: "Fiscal Técnico Petrobras",
    ultimoAcesso: "2026-09-17 08:30:00",
    criadoEm: "2026-08-10T10:00:00.000Z",
    atualizadoEm: "2026-09-10T11:00:00.000Z",
    autorizadoPor: "Gerência Geral de Suprimentos Petrobras",
    totpAtivo: true,
  },
  {
    id: "usr-gestor-petro-01",
    nome: "Mariana Albuquerque",
    email: "mariana.albuquerque@petrobras.com.br",
    empresa: "Petróleo Brasileiro S.A. – Petrobras",
    perfil: "PETROBRAS_GESTOR",
    status: "ATIVO",
    tipoConta: "SSO_MICROSOFT",
    basesVinculadas: ["TODAS"],
    cargo: "Fiscal Administrativo / Gestora Contratual",
    ultimoAcesso: "2026-09-16 16:45:00",
    criadoEm: "2026-08-10T10:00:00.000Z",
    atualizadoEm: "2026-08-10T10:00:00.000Z",
    autorizadoPor: "Diretoria de Suprimentos Petrobras",
    totpAtivo: true,
  },
  {
    id: "usr-supervisor-01",
    nome: "Renato Silva",
    email: "renato.silva@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_SUPERVISOR",
    status: "ATIVO",
    tipoConta: "LOCAL",
    basesVinculadas: ["UFN-III"],
    cargo: "Supervisor Operacional de Campo",
    ultimoAcesso: "2026-09-17 07:10:00",
    criadoEm: "2026-08-15T08:00:00.000Z",
    atualizadoEm: "2026-08-15T08:00:00.000Z",
    autorizadoPor: "Marcos Valério de Souza",
    totpAtivo: false,
  },
  {
    id: "usr-rh-01",
    nome: "Fabiana Ribeiro",
    email: "fabiana.ribeiro@premierlogistics.com.br",
    empresa: "Premier Logistics",
    perfil: "PREMIER_RH",
    status: "ATIVO",
    tipoConta: "LOCAL",
    basesVinculadas: ["TODAS"],
    cargo: "Analista de Recursos Humanos",
    ultimoAcesso: "2026-09-16 17:30:00",
    criadoEm: "2026-08-15T08:00:00.000Z",
    atualizadoEm: "2026-08-15T08:00:00.000Z",
    autorizadoPor: "Administrador Premier",
    totpAtivo: true,
  },
];

const LOGS_ADMIN_INICIAIS: LogAuditoriaAdmin[] = [
  {
    id: "log-adm-01",
    timestamp: "2026-09-01 08:00:00",
    usuarioId: "usr-admin-01",
    usuarioNome: "Administrador Premier",
    usuarioPerfil: "PREMIER_ADMIN",
    acao: "CRIAR_USUARIO",
    entidade: "USUARIO",
    entidadeId: "usr-admin-01",
    descricao: "Inicialização da conta mestre do Administrador Premier",
    valorAnterior: null,
    valorNovo: "Perfil: PREMIER_ADMIN | Bases: TODAS",
  },
  {
    id: "log-adm-02",
    timestamp: "2026-09-05 09:30:00",
    usuarioId: "usr-admin-01",
    usuarioNome: "Administrador Premier",
    usuarioPerfil: "PREMIER_ADMIN",
    acao: "CRIAR_USUARIO",
    entidade: "USUARIO",
    entidadeId: "usr-gestor-01",
    descricao: "Concessão de acesso corporativo via SSO Entra ID",
    valorAnterior: null,
    valorNovo: "Perfil: PREMIER_GESTOR | Bases: TODAS",
  },
  {
    id: "log-adm-03",
    timestamp: "2026-09-10 10:15:00",
    usuarioId: "usr-admin-01",
    usuarioNome: "Administrador Premier",
    usuarioPerfil: "PREMIER_ADMIN",
    acao: "VINCULO_BASE",
    entidade: "USUARIO",
    entidadeId: "usr-fiscal-01",
    descricao: "Restrição territorial estrita de base contratual para fiscalização",
    valorAnterior: "Bases: TODAS",
    valorNovo: "Bases: UFN-III",
  },
];

let usuariosMemoria: UsuarioCadastro[] = [...USUARIOS_PADRAO];
let logsAdminMemoria: LogAuditoriaAdmin[] = [...LOGS_ADMIN_INICIAIS];

export function carregarUsuarios(): UsuarioCadastro[] {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_USUARIOS);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed) && parsed.length > 0) {
          usuariosMemoria = parsed;
        }
      }
    } catch {
      // fallback
    }
  }
  return usuariosMemoria;
}

export function salvarUsuarios(usuarios: UsuarioCadastro[]) {
  usuariosMemoria = usuarios;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_USUARIOS, JSON.stringify(usuarios));
      window.dispatchEvent(new CustomEvent("sgp-usuarios-atualizados", { detail: usuarios }));
    } catch {
      // ignora
    }
  }
}

export function carregarLogsAuditoriaAdmin(): LogAuditoriaAdmin[] {
  if (typeof window !== "undefined") {
    try {
      const salvo = localStorage.getItem(CHAVE_STORAGE_AUDITORIA_ADMIN);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        if (Array.isArray(parsed) && parsed.length > 0) {
          logsAdminMemoria = parsed;
        }
      }
    } catch {
      // fallback
    }
  }
  return logsAdminMemoria;
}

export function registrarLogAuditoriaAdmin(
  executor: UsuarioSessao,
  acao: string,
  entidade: LogAuditoriaAdmin["entidade"],
  entidadeId: string,
  descricao: string,
  valorAnterior: string | null,
  valorNovo: string | null
) {
  const novoLog: LogAuditoriaAdmin = {
    id: `log-adm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
    usuarioId: executor.id,
    usuarioNome: executor.nome,
    usuarioPerfil: executor.perfil,
    acao,
    entidade,
    entidadeId,
    descricao,
    valorAnterior,
    valorNovo,
    ip: "189.120.45.12",
  };

  logsAdminMemoria = [novoLog, ...carregarLogsAuditoriaAdmin()];
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(CHAVE_STORAGE_AUDITORIA_ADMIN, JSON.stringify(logsAdminMemoria));
      window.dispatchEvent(new CustomEvent("sgp-auditoria-admin-atualizada", { detail: logsAdminMemoria }));
    } catch {
      // ignora
    }
  }
  return novoLog;
}

/**
 * Validação de segurança: Verifica se é o último Administrador Premier ativo
 */
export function ehUltimoAdminAtivo(usuarioId: string): boolean {
  const usuarios = carregarUsuarios();
  const adminsAtivos = usuarios.filter(
    (u) => u.perfil === "PREMIER_ADMIN" && u.status === "ATIVO"
  );
  return adminsAtivos.length === 1 && adminsAtivos[0].id === usuarioId;
}

export function obterUsuarioPorId(id: string): UsuarioCadastro | undefined {
  const usuarios = carregarUsuarios();
  return usuarios.find((u) => u.id === id);
}

export function obterUsuarioPorEmail(email: string): UsuarioCadastro | undefined {
  const usuarios = carregarUsuarios();
  return usuarios.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
}

/**
 * Criação de Usuário
 */
export function criarUsuario(
  dados: Omit<UsuarioCadastro, "id" | "criadoEm" | "atualizadoEm">,
  executor: UsuarioSessao
): UsuarioCadastro {
  const usuarios = carregarUsuarios();
  const emailNorm = dados.email.toLowerCase().trim();

  if (usuarios.some((u) => u.email.toLowerCase() === emailNorm)) {
    throw new Error(`Já existe um usuário cadastrado com o e-mail ${emailNorm}.`);
  }

  const agora = new Date().toISOString();
  const novoUsuario: UsuarioCadastro = {
    ...dados,
    id: `usr-${Date.now()}`,
    email: emailNorm,
    criadoEm: agora,
    atualizadoEm: agora,
    autorizadoPor: executor.nome,
  };

  const novaLista = [...usuarios, novoUsuario];
  salvarUsuarios(novaLista);

  registrarLogAuditoriaAdmin(
    executor,
    "CRIAR_USUARIO",
    "USUARIO",
    novoUsuario.id,
    `Criação do usuário ${novoUsuario.nome} (${novoUsuario.email}) com perfil ${novoUsuario.perfil}`,
    null,
    `Perfil: ${novoUsuario.perfil} | Status: ${novoUsuario.status} | Conta: ${novoUsuario.tipoConta} | Bases: ${novoUsuario.basesVinculadas.join(", ")}`
  );

  return novoUsuario;
}

/**
 * Atualização de Perfil de Usuário
 */
export function atualizarPerfilUsuario(
  usuarioId: string,
  novoPerfil: PerfilUsuario,
  executor: UsuarioSessao
): UsuarioCadastro {
  // Regra 1: Nenhum usuário pode alterar o próprio perfil
  if (executor.id === usuarioId) {
    throw new Error("Regra de Segurança: Nenhum usuário tem permissão para alterar o próprio perfil.");
  }

  // Regra 2: Impedir rebaixar o último Administrador Premier ativo
  if (ehUltimoAdminAtivo(usuarioId) && novoPerfil !== "PREMIER_ADMIN") {
    throw new Error("Regra de Segurança: Não é permitido rebaixar o último Administrador Premier ativo do sistema.");
  }

  const usuarios = carregarUsuarios();
  const index = usuarios.findIndex((u) => u.id === usuarioId);
  if (index === -1) {
    throw new Error("Usuário não encontrado.");
  }

  const usuarioAnterior = usuarios[index];
  const perfilAnterior = usuarioAnterior.perfil;

  if (perfilAnterior === novoPerfil) {
    return usuarioAnterior;
  }

  const agora = new Date().toISOString();
  const usuarioAtualizado: UsuarioCadastro = {
    ...usuarioAnterior,
    perfil: novoPerfil,
    atualizadoEm: agora,
  };

  usuarios[index] = usuarioAtualizado;
  salvarUsuarios([...usuarios]);

  registrarLogAuditoriaAdmin(
    executor,
    "ALTERAR_PERFIL",
    "USUARIO",
    usuarioId,
    `Perfil de "${usuarioAnterior.nome}" alterado de ${perfilAnterior} para ${novoPerfil}`,
    `Perfil: ${perfilAnterior}`,
    `Perfil: ${novoPerfil}`
  );

  return usuarioAtualizado;
}

/**
 * Atualização de Vínculo de Bases Territoriais
 */
export function atualizarBasesUsuario(
  usuarioId: string,
  novasBases: string[],
  executor: UsuarioSessao
): UsuarioCadastro {
  const usuarios = carregarUsuarios();
  const index = usuarios.findIndex((u) => u.id === usuarioId);
  if (index === -1) {
    throw new Error("Usuário não encontrado.");
  }

  const usuarioAnterior = usuarios[index];
  const basesAnteriores = usuarioAnterior.basesVinculadas.join(", ");
  const basesNovasStr = novasBases.length > 0 ? novasBases.join(", ") : "NENHUMA";

  const agora = new Date().toISOString();
  const usuarioAtualizado: UsuarioCadastro = {
    ...usuarioAnterior,
    basesVinculadas: novasBases.length > 0 ? novasBases : ["TODAS"],
    atualizadoEm: agora,
  };

  usuarios[index] = usuarioAtualizado;
  salvarUsuarios([...usuarios]);

  registrarLogAuditoriaAdmin(
    executor,
    "VINCULO_BASE",
    "USUARIO",
    usuarioId,
    `Vínculo de bases do usuário "${usuarioAnterior.nome}" atualizado`,
    `Bases: ${basesAnteriores}`,
    `Bases: ${basesNovasStr}`
  );

  return usuarioAtualizado;
}

/**
 * Ativação / Desativação de Usuário
 */
export function alterarStatusUsuario(
  usuarioId: string,
  novoStatus: StatusUsuario,
  executor: UsuarioSessao
): UsuarioCadastro {
  // Regra 1: Impedir desativar o último Administrador Premier ativo
  if (ehUltimoAdminAtivo(usuarioId) && novoStatus !== "ATIVO") {
    throw new Error("Regra de Segurança: Não é permitido desativar o último Administrador Premier ativo do sistema.");
  }

  const usuarios = carregarUsuarios();
  const index = usuarios.findIndex((u) => u.id === usuarioId);
  if (index === -1) {
    throw new Error("Usuário não encontrado.");
  }

  const usuarioAnterior = usuarios[index];
  const statusAnterior = usuarioAnterior.status;

  if (statusAnterior === novoStatus) {
    return usuarioAnterior;
  }

  const agora = new Date().toISOString();
  const usuarioAtualizado: UsuarioCadastro = {
    ...usuarioAnterior,
    status: novoStatus,
    atualizadoEm: agora,
  };

  usuarios[index] = usuarioAtualizado;
  salvarUsuarios([...usuarios]);

  registrarLogAuditoriaAdmin(
    executor,
    novoStatus === "ATIVO" ? "ATIVAR_USUARIO" : "DESATIVAR_USUARIO",
    "USUARIO",
    usuarioId,
    `Status do usuário "${usuarioAnterior.nome}" alterado de ${statusAnterior} para ${novoStatus}`,
    `Status: ${statusAnterior}`,
    `Status: ${novoStatus}`
  );

  return usuarioAtualizado;
}

/**
 * Redefinição de Senha (Apenas contas locais)
 */
export function redefinirSenhaLocal(
  usuarioId: string,
  executor: UsuarioSessao
): { sucesso: boolean; mensagem: string } {
  const usuario = obterUsuarioPorId(usuarioId);
  if (!usuario) {
    throw new Error("Usuário não encontrado.");
  }

  if (usuario.tipoConta !== "LOCAL") {
    throw new Error("Redefinição de senha manual só é permitida para contas locais. Contas SSO utilizam o Microsoft Entra ID.");
  }

  registrarLogAuditoriaAdmin(
    executor,
    "REDEFINIR_SENHA",
    "USUARIO",
    usuarioId,
    `Solicitação de redefinição de credenciais gerada para conta local de ${usuario.nome} (${usuario.email})`,
    "Senha em vigor",
    "Token temporário de primeiro acesso emitido"
  );

  return {
    sucesso: true,
    mensagem: `Instruções de redefinição de senha emitidas para ${usuario.email}.`,
  };
}

/**
 * Exclusão / Remoção de Usuário
 */
export function excluirUsuario(usuarioId: string, executor: UsuarioSessao): boolean {
  if (executor.id === usuarioId) {
    throw new Error("Regra de Segurança: Não é permitido excluir a própria conta.");
  }

  if (ehUltimoAdminAtivo(usuarioId)) {
    throw new Error("Regra de Segurança: Não é permitido remover o último Administrador Premier ativo.");
  }

  const usuarios = carregarUsuarios();
  const usuarioAlvo = usuarios.find((u) => u.id === usuarioId);
  if (!usuarioAlvo) {
    throw new Error("Usuário não encontrado.");
  }

  const novaLista = usuarios.filter((u) => u.id !== usuarioId);
  salvarUsuarios(novaLista);

  registrarLogAuditoriaAdmin(
    executor,
    "EXCLUIR_USUARIO",
    "USUARIO",
    usuarioId,
    `Usuário "${usuarioAlvo.nome}" (${usuarioAlvo.email}) excluído definitivamente do cadastro`,
    `Perfil: ${usuarioAlvo.perfil} | Status: ${usuarioAlvo.status}`,
    null
  );

  return true;
}
