/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * Feriados NACIONAIS — fonte única, sem dependências (usada pela camada de dados e pelo
 * interpretador de horários do RM, evitando ciclos de import).
 *
 * Feriados estaduais/municipais por base continuam em FERIADOS_OFICIAIS_CONTRATO
 * (estado-operacional.ts), que inclui esta lista.
 */

export interface FeriadoNacional {
  data: string; // YYYY-MM-DD
  nome: string;
  tipo: "NACIONAL";
}

export const FERIADOS_NACIONAIS: FeriadoNacional[] = [
  // 2026
  { data: "2026-01-01", nome: "Confraternização Universal", tipo: "NACIONAL" },
  { data: "2026-04-03", nome: "Paixão de Cristo", tipo: "NACIONAL" },
  { data: "2026-04-21", nome: "Tiradentes", tipo: "NACIONAL" },
  { data: "2026-05-01", nome: "Dia Mundial do Trabalho", tipo: "NACIONAL" },
  { data: "2026-09-07", nome: "Independência do Brasil", tipo: "NACIONAL" },
  { data: "2026-10-12", nome: "Nossa Senhora Aparecida", tipo: "NACIONAL" },
  { data: "2026-11-02", nome: "Finados", tipo: "NACIONAL" },
  { data: "2026-11-15", nome: "Proclamação da República", tipo: "NACIONAL" },
  { data: "2026-11-20", nome: "Dia Nacional de Zumbi e da Consciência Negra", tipo: "NACIONAL" },
  { data: "2026-12-25", nome: "Natal", tipo: "NACIONAL" },
  // 2027 (competências 2027-01 em diante)
  { data: "2027-01-01", nome: "Confraternização Universal", tipo: "NACIONAL" },
  { data: "2027-03-26", nome: "Paixão de Cristo", tipo: "NACIONAL" },
  { data: "2027-04-21", nome: "Tiradentes", tipo: "NACIONAL" },
  { data: "2027-05-01", nome: "Dia Mundial do Trabalho", tipo: "NACIONAL" },
  { data: "2027-09-07", nome: "Independência do Brasil", tipo: "NACIONAL" },
  { data: "2027-10-12", nome: "Nossa Senhora Aparecida", tipo: "NACIONAL" },
  { data: "2027-11-02", nome: "Finados", tipo: "NACIONAL" },
  { data: "2027-11-15", nome: "Proclamação da República", tipo: "NACIONAL" },
  { data: "2027-11-20", nome: "Dia Nacional de Zumbi e da Consciência Negra", tipo: "NACIONAL" },
  { data: "2027-12-25", nome: "Natal", tipo: "NACIONAL" },
];

const DATAS_FERIADOS_NACIONAIS = new Set(FERIADOS_NACIONAIS.map((f) => f.data));

export function ehFeriadoNacional(dataIso: string): boolean {
  return DATAS_FERIADOS_NACIONAIS.has(dataIso.slice(0, 10));
}
