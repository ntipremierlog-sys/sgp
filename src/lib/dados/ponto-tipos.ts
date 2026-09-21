/**
 * SGP — Sistema de Gestão de Postos (Premier Logistics / Contrato Petrobras ICJ 5900.0129796.25.2)
 * MOMENTO 4: Tipos e Interfaces para Registros de Ponto, Marcações Originais,
 * Modelos de Arquivo, Fusos Horários e Apuração Diária de Presença.
 *
 * Finalidade estrita: GESTÃO de presença, ausência e cobertura dos postos contratuais.
 */

export type FusoHorarioBase = "America/Sao_Paulo" | "America/Campo_Grande" | "America/Manaus";

export interface BaseOperacionalFuso {
  unidadeId: string;
  nome: string;
  fusoHorario: FusoHorarioBase;
  diferencaUtcHoras: number; // -3 (Brasília), -4 (MS/AM)
}

/**
 * Registro de marcação original de ponto (Tabela SOMENTE DE INCLUSÃO).
 * Chave de unicidade lógica: colaboradorId + dataHoraUtc (minuto) + nsr.
 * Minimização LGPD: Somente identificação, data, hora, NSR e equipamento.
 */
export interface MarcacaoPontoOriginal {
  id: string; // Ex: "MK-037196-20260831T095900Z-000123"
  loteId: string;
  arquivoOrigem: string;
  colaboradorId: string; // ID do profissional no SGP (ex: "prf-037196")
  chapa: string;         // Normalizada em 6 dígitos
  cpfLimpo: string;      // 11 dígitos
  dataHoraUtc: string;   // ISO-8601 UTC (ex: "2026-08-31T09:59:00.000Z")
  dataLocal: string;     // YYYY-MM-DD no fuso da base
  horaLocal: string;     // HH:MM ou HH:MM:SS no fuso da base
  nsr?: string;          // Número Sequencial de Registro (quando existir)
  equipamentoOrigem?: string;
  importadoEm: string;
}

/**
 * Modelo de mapeamento de colunas de planilha de ponto (RHID ou outro).
 */
export interface MapeamentoColunasPonto {
  id: string;
  nomeModelo: string; // Ex: "RHID – Exportação Padrão", "Cubo de Registros – RM"
  separadorCsv?: ";" | ",";
  codificacao?: "UTF-8" | "ISO-8859-1";
  colunaIdentificador: string; // Nome ou índice da coluna (CPF, PIS ou Chapa)
  tipoIdentificador: "CPF" | "PIS" | "CHAPA" | "AUTO";
  colunaData: string;
  formatoData: "DD/MM/YYYY" | "YYYY-MM-DD" | "EXCEL_SERIAL";
  colunaHora?: string; // Se nula, data e hora estão na mesma coluna ou em múltiplas batidas
  formatoHora: "HH:MM" | "HH:MM:SS" | "EXCEL_FRACTION";
  // Suporte a formatos matriciais/cubo (múltiplas batidas por linha: ENT1, SAI1, ENT2, SAI2...)
  colunasMultiplasBatidas?: {
    ent1?: string;
    sai1?: string;
    ent2?: string;
    sai2?: string;
    ent3?: string;
    sai3?: string;
  };
  colunaNsr?: string;
  colunaEquipamento?: string;
  padrao?: boolean;
}

/**
 * Interpretação de horários cadastrados para apuração de escala.
 */
export interface HorarioInterpretado {
  codigoHorario: string; // Ex: "1388", "1443", "1391"
  descricaoRm: string;
  tipoEscala: "SEG/SEX" | "SEG/DOM" | "12X36" | "4X4" | "4X2" | "OUTRO";
  atravessaMeiaNoite: boolean;
  horaEntradaPadrao: string; // "07:00", "18:30"
  horaSaidaPadrao: string;   // "19:00", "06:30"
  segundoTurno?: {           // Para escala 4x2 com turnos alternados
    horaEntrada: string;
    horaSaida: string;
  };
  confirmado: boolean;
  atualizadoEm: string;
  atualizadoPor: string;
}

/**
 * Configuração de Data-Base para escalas cíclicas (12x36, 4x4, 4x2) por colaborador.
 */
export interface CicloEscalaColaborador {
  colaboradorId: string;
  chapa: string;
  horarioCodigo: string;
  dataBaseCiclo?: string; // YYYY-MM-DD do primeiro dia de trabalho do ciclo
  dataBaseSugerida?: string;
  confirmado: boolean;
  atualizadoEm?: string;
  atualizadoPor?: string;
}

/**
 * Situação diária apurada por colaborador (ordem estrita de prioridade de 1 a 9).
 */
export type SituacaoPresencaDiaria =
  | "DESLIGADO"              // 1. Após a data de demissão
  | "FERIAS_AFASTADO_LICENCA"// 2. Situação do RM no período
  | "FOLGA_ESCALA"           // 3. Dia sem jornada prevista
  | "AUSENCIA_JUSTIFICADA"   // 4. Abono aprovado do Momento 3 cobrindo a jornada
  | "PRESENTE"               // 5. Marcações de entrada e saída associadas
  | "MARCACAO_INCOMPLETA"    // 6. Número ímpar ou falta entrada/saída
  | "FALTA"                  // 7. Jornada prevista sem marcação e sem abono (até data-ref lote)
  | "SEM_DADO"               // 8. Dia posterior à data de referência do último lote de ponto
  | "ESCALA_NAO_CONFIRMADA"; // 9. Escala cíclica sem data-base confirmada

/**
 * Espelho diário de apuração por colaborador.
 */
export interface ApuracaoPresencaDiaria {
  id: string; // `${chapa}_${data}`
  colaboradorId: string;
  chapa: string;
  nomeColaborador: string;
  cpfMascarado: string;
  baseId: string;
  baseNome: string;
  fusoHorario: FusoHorarioBase;
  data: string; // YYYY-MM-DD (local)
  diaSemana: string;
  postoCodigo?: string;
  funcao?: string;
  jornadaPrevista?: {
    horaInicio: string;
    horaFim: string;
    atravessaMeiaNoite: boolean;
    tipoEscala: string;
  };
  situacao: SituacaoPresencaDiaria;
  marcacoesDoDia: {
    horaLocal: string; // HH:MM
    horaUtc: string;
    nsr?: string;
    loteId: string;
    equipamento?: string;
  }[];
  indicadores: {
    abonoParcial?: boolean;
    entradaAposHorario?: boolean; // Tolerância > 10 min
    saidaAntesHorario?: boolean;  // Tolerância > 10 min
    toleranciaMinutos: number;    // 10 min padrão
  };
  abonoVinculado?: {
    ocorrenciaId: string;
    tipoOcorrencia: string;
    observacaoPublica: string;
  };
  observacaoGestao?: {
    texto: string;
    autor: string;
    dataHora: string;
  };
}

/**
 * Situação diária do posto contratual (Anexo 1-A / Mapa de Ocupação).
 */
export type SituacaoPostoDia =
  | "P" // PRESENTE: Titular presente
  | "C" // COBERTO: Titular ausente com substituto da cobertura presente
  | "D" // DESCOBERTO: Titular ausente sem substituto presente
  | "V" // VAGO: Posto sem titular vinculado
  | "–" // SEM ESCALA: Folga da escala do posto
  | "A" // AGUARDANDO TURNO: Jornada ainda não iniciada no dia atual
  | "?"; // SEM DADO: Dia posterior ao último lote de ponto importado

/**
 * Pendência de ponto gerada para verificação de gestão.
 */
export interface PendenciaPontoItem {
  id: string;
  tipo: "MARCACAO_INCOMPLETA" | "FALTA_SEM_ABONO" | "ESCALA_NAO_CONFIRMADA" | "COLABORADOR_NAO_ENCONTRADO";
  colaboradorId?: string;
  chapa?: string;
  nome?: string;
  baseId?: string;
  dataReferencia: string;
  detalhes: string;
  status: "ABERTA" | "VERIFICADA" | "CORRIGIDA_ORIGEM";
  observacao?: string;
  atualizadoPor?: string;
  atualizadoEm?: string;
}

/**
 * Resultado da importação de lote de ponto.
 */
export interface ResultadoImportacaoPonto {
  sucesso: boolean;
  loteId: string;
  arquivoNome: string;
  formato: "AFD" | "PLANILHA";
  modeloUtilizado?: string;
  hashSha256: string;
  dataReferenciaLote: string; // Data/hora da marcação mais recente do arquivo (YYYY-MM-DD HH:MM)
  dataExecucao: string;
  totais: {
    linhasLidas: number;
    marcacoesNovas: number;
    marcacoesJaImportadas: number;
    colaboradoresNaoEncontrados: number;
    alertasDemitidos: number;
    inconsistenciasEstruturais: number;
  };
  inconsistencias: {
    linha: number;
    campo?: string;
    identificador?: string;
    motivo: string;
    gravidade: "ERRO" | "ALERTA";
  }[];
  marcacoesImportadas: MarcacaoPontoOriginal[];
  diasSemJornadaPrevista?: string[]; // Chaves no formato `${chapa}_${dataLocal}` onde HORA_BASE2 == 0
}
