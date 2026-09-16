import { z } from "zod";

/**
 * Utilitários de parsing para o formato brasileiro
 * Converte datas dd/mm/aaaa, números decimais com vírgula e sanitiza CPF
 */

export function parseDataBrasileira(valor: string): Date | null {
  if (!valor || typeof valor !== "string") return null;
  const limpo = valor.trim();
  const match = limpo.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const dia = parseInt(match[1], 10);
  const mes = parseInt(match[2], 10) - 1;
  const ano = parseInt(match[3], 10);

  const data = new Date(ano, mes, dia);
  if (
    data.getFullYear() === ano &&
    data.getMonth() === mes &&
    data.getDate() === dia
  ) {
    return data;
  }
  return null;
}

export function parseDecimalBrasileiro(valor: string | number): number | null {
  if (typeof valor === "number") return valor;
  if (!valor || typeof valor !== "string") return null;
  const normalizado = valor.trim().replace(/\./g, "").replace(",", ".");
  const num = parseFloat(normalizado);
  return isNaN(num) ? null : num;
}

export function sanitizarCpf(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

export function mascararCpf(cpf: string): string {
  const digitos = sanitizarCpf(cpf);
  if (digitos.length !== 11) return "***.***.***-**";
  return `***.${digitos.slice(3, 6)}.${digitos.slice(6, 9)}-**`;
}

// -----------------------------------------------------------------------------
// SCHEMAS ZOD DE VALIDAÇÃO
// -----------------------------------------------------------------------------

export const ColaboradorImportSchema = z.object({
  matricula: z.string().min(1, "Matrícula é obrigatória"),
  nomeCompleto: z.string().min(3, "Nome completo deve ter no mínimo 3 caracteres"),
  cpf: z.string().refine((val) => sanitizarCpf(val).length === 11, {
    message: "CPF deve conter exatamente 11 dígitos numéricos",
  }),
  dataNascimento: z.string().optional(),
  funcao: z.string().min(2, "Função/Cargo é obrigatório"),
  unidadeCodigo: z.string().min(1, "Código ou nome da Unidade é obrigatório"),
  postoCodigo: z.string().optional(),
  escala: z.enum(["5x2", "12x36", "6x1", "OUTRA"]),
  jornadaSemanalHoras: z.string().or(z.number()),
  horarioInicio: z.string().regex(/^\d{2}:\d{2}$/, "Horário de início deve ser HH:MM"),
  horarioFim: z.string().regex(/^\d{2}:\d{2}$/, "Horário de término deve ser HH:MM"),
  dataAdmissao: z.string().min(1, "Data de admissão é obrigatória"),
  dataDesligamento: z.string().optional().nullable(),
  situacao: z.enum(["ATIVO", "AFASTADO", "FERIAS", "DESLIGADO"]).default("ATIVO"),
  telefoneCorporativo: z.string().optional(),
});

export const PontoImportSchema = z.object({
  matricula: z.string().min(1, "Matrícula é obrigatória"),
  data: z.string().min(1, "Data da frequência é obrigatória"),
  situacaoPonto: z.enum(["PRESENTE", "AUSENTE", "FOLGA", "FERIAS", "AFASTADO", "NAO_APLICAVEL"]),
  horaEntrada: z.string().optional().nullable(),
  horaSaida: z.string().optional().nullable(),
  horasTrabalhadas: z.string().or(z.number()).optional().nullable(),
  codigoPosto: z.string().optional().nullable(),
});

export const OcorrenciaImportSchema = z.object({
  matricula: z.string().min(1, "Matrícula é obrigatória"),
  tipoOcorrencia: z.enum([
    "ATESTADO_MEDICO",
    "FALTA_JUSTIFICADA",
    "FALTA_INJUSTIFICADA",
    "ABONO_LEGAL",
    "FERIAS",
    "TREINAMENTO",
    "FOLGA_ESCALA",
    "OUTROS",
  ]),
  dataInicio: z.string().min(1, "Data de início da ocorrência é obrigatória"),
  dataFim: z.string().min(1, "Data de término da ocorrência é obrigatória"),
  observacaoPublica: z.string().optional().nullable(),
  // Dados sensíveis segregados (LGPD - Tabela isolada)
  cid: z.string().optional().nullable(),
  medicoEmissor: z.string().optional().nullable(),
  crm: z.string().optional().nullable(),
});

export type ColaboradorImportInput = z.infer<typeof ColaboradorImportSchema>;
export type PontoImportInput = z.infer<typeof PontoImportSchema>;
export type OcorrenciaImportInput = z.infer<typeof OcorrenciaImportSchema>;

export interface ResultadoValidacaoLinha {
  linha: number;
  valido: boolean;
  erros: string[];
  dados: Record<string, unknown>;
}
