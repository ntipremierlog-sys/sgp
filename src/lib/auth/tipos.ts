export type PerfilUsuario =
  | "PREMIER_ADMIN"
  | "PREMIER_GESTOR"
  | "PREMIER_GESTOR_CONTRATO"
  | "PREMIER_SUPERVISOR"
  | "PREMIER_RH"
  | "PETROBRAS_FISCAL"
  | "PETROBRAS_GESTOR"
  | "AUDITOR"
  | "PENDENTE_PERFIL";

export type StatusUsuario = "ATIVO" | "INATIVO" | "BLOQUEADO" | "PENDENTE";

export type TipoConta = "SSO_MICROSOFT" | "LOCAL";

export type Acao = "LER" | "CRIAR" | "EDITAR" | "EXCLUIR" | "EXPORTAR" | "GERENCIAR";

export type Recurso =
  | "PAINEL"
  | "MAPA_OCUPACAO"
  | "POSTOS"
  | "PROFISSIONAIS"
  | "OCORRENCIAS"
  | "COBERTURAS"
  | "APONTAMENTOS"
  | "RELATORIOS"
  | "CONFORMIDADE"
  | "AUDITORIA"
  | "IMPORTACOES"
  | "ADMINISTRACAO"
  | "PARAMETROS_CONTRATO"
  | "CONCILIACAO_SIFAC"
  | "DADOS_SENSIVEIS_LGPD"
  | "GLOSA_FINANCEIRA";

export interface UsuarioSessao {
  id: string;
  nome: string;
  email: string;
  empresa: "Premier Logistics" | "Petróleo Brasileiro S.A. – Petrobras";
  perfil: PerfilUsuario;
  status: StatusUsuario;
  tipoConta: TipoConta;
  basesVinculadas: string[]; // ["TODAS"] ou lista como ["UFN-III", "MACAE"]
  cargo?: string;
  ultimoAcesso?: string;
}

export interface UsuarioCadastro extends UsuarioSessao {
  criadoEm: string;
  atualizadoEm: string;
  autorizadoPor?: string;
  bloqueadoAte?: string | null;
  totpAtivo?: boolean;
}

export interface LogAuditoriaAdmin {
  id: string;
  timestamp: string;
  usuarioId: string;
  usuarioNome: string;
  usuarioPerfil: PerfilUsuario;
  acao: string;
  entidade: "USUARIO" | "PARAMETRO_CONTRATO" | "PERMISSAO" | "PROFISSIONAL" | "LOTE_IMPORTACAO" | "SECAO";
  entidadeId: string;
  descricao: string;
  valorAnterior: string | null;
  valorNovo: string | null;
  ip?: string;
}

export interface ParametrosContrato {
  id: string;
  contratoNumero: string;
  fatorGlosa: number | null; // ex: 1.0 (100%) ou null (pendente)
  prazoFechamento: string | null; // ex: "5º dia útil" ou "2026-10-05" ou null (pendente)
  metaSla: number; // padrão 95.0
  atualizadoEm: string;
  atualizadoPor: string;
}
