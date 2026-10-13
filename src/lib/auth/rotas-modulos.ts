import type { Recurso } from "./tipos";

/**
 * Mapa de rotas de tela → módulo (recurso) de permissão.
 * Usado pela guarda de telas (Acesso negado) e mantém o mesmo agrupamento do menu lateral.
 * Rotas não listadas ficam liberadas a qualquer usuário autenticado.
 * /admin/* é protegido pelo middleware (exclusivo do Administrador).
 */
const ROTAS_MODULOS: { prefixo: string; recurso: Recurso }[] = [
  { prefixo: "/painel", recurso: "PAINEL" },
  { prefixo: "/alertas", recurso: "PAINEL" },
  { prefixo: "/mapa-ocupacao", recurso: "MAPA_OCUPACAO" },
  { prefixo: "/descobertos", recurso: "MAPA_OCUPACAO" },
  { prefixo: "/presenca-diaria", recurso: "MAPA_OCUPACAO" },
  { prefixo: "/coberturas", recurso: "COBERTURAS" },
  { prefixo: "/ocorrencias", recurso: "OCORRENCIAS" },
  { prefixo: "/profissionais", recurso: "PROFISSIONAIS" },
  { prefixo: "/feristas", recurso: "PROFISSIONAIS" },
  { prefixo: "/postos", recurso: "POSTOS" },
  { prefixo: "/relatorios", recurso: "RELATORIOS" },
  { prefixo: "/fechamento", recurso: "RELATORIOS" },
  { prefixo: "/apontamentos", recurso: "APONTAMENTOS" },
  { prefixo: "/conformidade", recurso: "CONFORMIDADE" },
  { prefixo: "/importacoes", recurso: "IMPORTACOES" },
  { prefixo: "/conciliacao-sifac", recurso: "CONCILIACAO_SIFAC" },
  { prefixo: "/auditoria", recurso: "AUDITORIA" },
];

export function recursoDaRota(pathname: string): Recurso | null {
  const item = ROTAS_MODULOS.find((r) => pathname === r.prefixo || pathname.startsWith(r.prefixo + "/"));
  return item ? item.recurso : null;
}
