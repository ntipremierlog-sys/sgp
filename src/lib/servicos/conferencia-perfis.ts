/**
 * Perfis da Conferência Petrobras por prévia (fonte única para telas e APIs).
 */
export const PERFIS_CONFERENCIA = ["PETROBRAS_FISCAL", "PREMIER_ADMIN", "PREMIER_GESTOR", "PREMIER_GESTOR_CONTRATO"];
/** Parecer da fiscal: Fiscal Petrobras (e Premier/Administração, para testes). */
export const PERFIS_PARECER_FISCAL = ["PETROBRAS_FISCAL", "PREMIER_ADMIN"];
/** Justificativa da Premier por linha. */
export const PERFIS_JUSTIFICATIVA_PREMIER = ["PREMIER_ADMIN", "PREMIER_GESTOR", "PREMIER_GESTOR_CONTRATO"];

export const ROTULO_SITUACAO_APURADA: Record<string, string> = {
  COBERTO: "Coberto",
  DESCOBERTO: "Descoberto",
  SEM_OCUPANTE: "Sem ocupante",
  SEM_DADO: "Sem dado",
  PENDENTE: "Pendente",
  CICLO_NAO_CONFIGURADO: "Ciclo não configurado",
};

export const ROTULO_PARECER: Record<string, string> = {
  COBERTO: "Coberto",
  DESCOBERTO: "Descoberto",
  PARCIAL: "Parcial",
  PENDENTE: "Pendente",
};

export const ROTULO_SITUACAO_CONFERENCIA: Record<string, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};
