/**
 * SGP — Sistema de Gestão de Postos
 * Utilitário de Backup Completo Pré-Limpeza e Pós-Operações
 *
 * Registra o estado integral do sistema (postos, colaboradores, ocorrências,
 * coberturas, apontamentos, logs de auditoria e configurações) em arquivo JSON.
 */

import { carregarEstado, EstadoOperacionalCompleto, salvarEstado } from "./estado-operacional";
import { obterParametrosContrato } from "../auth/parametros";
import { carregarUsuarios } from "../auth/usuarios";

export interface SnapshotBackupSGP {
  versao: string;
  timestamp: string;
  motivo: string;
  autor: string;
  contrato: {
    numeroIcj: string;
    numeroSifac: string;
    cliente: string;
  };
  parametros: ReturnType<typeof obterParametrosContrato>;
  usuariosCount: number;
  estadoOperacional: EstadoOperacionalCompleto;
}

/**
 * Gera um objeto de snapshot com todo o estado atual do sistema
 */
export function gerarSnapshotSistema(
  motivo: string = "Backup pré-limpeza de dados de demonstração",
  autor: string = "Administrador Premier (Marcos Valério)"
): SnapshotBackupSGP {
  const estado = carregarEstado();
  const parametros = obterParametrosContrato();
  const usuarios = carregarUsuarios();

  return {
    versao: "1.0.0",
    timestamp: new Date().toISOString(),
    motivo,
    autor,
    contrato: {
      numeroIcj: "5900.0129796.25.2",
      numeroSifac: "4600682336",
      cliente: "Petróleo Brasileiro S.A. - Petrobras",
    },
    parametros,
    usuariosCount: usuarios.length,
    estadoOperacional: JSON.parse(JSON.stringify(estado)),
  };
}

/**
 * Restaura o estado operacional a partir de um snapshot de backup
 */
export function restaurarSnapshotSistema(snapshot: SnapshotBackupSGP): boolean {
  if (!snapshot || !snapshot.estadoOperacional) {
    throw new Error("Snapshot de backup inválido.");
  }
  salvarEstado(snapshot.estadoOperacional);
  return true;
}
