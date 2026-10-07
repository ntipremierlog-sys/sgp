import fs from "fs";
import path from "path";
import { SnapshotBackupSGP } from "./backup-dados";

const PASTA_BACKUPS = path.resolve(process.cwd(), "backups");

export interface ItemBackupDisco {
  nomeArquivo: string;
  caminhoCompleto: string;
  tamanhoBytes: number;
  tamanhoFormatado: string;
  dataCriacao: string;
  dataModificacao: string;
  motivo?: string;
  autor?: string;
}

function formatarBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Garante que a pasta de backups exista
 */
export function garantirPastaBackups(): string {
  if (!fs.existsSync(PASTA_BACKUPS)) {
    fs.mkdirSync(PASTA_BACKUPS, { recursive: true });
  }
  return PASTA_BACKUPS;
}

/**
 * Salva um snapshot de backup em arquivo JSON no disco
 */
export function salvarBackupEmDisco(
  snapshot: SnapshotBackupSGP,
  prefixo: string = "backup_limpeza_dados"
): { nomeArquivo: string; caminhoCompleto: string } {
  garantirPastaBackups();

  const timestampFormatado = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .substring(0, 19);

  const nomeArquivo = `${prefixo}_${timestampFormatado}.json`;
  const caminhoCompleto = path.join(PASTA_BACKUPS, nomeArquivo);

  fs.writeFileSync(caminhoCompleto, JSON.stringify(snapshot, null, 2), "utf-8");

  return { nomeArquivo, caminhoCompleto };
}

/**
 * Lista todos os arquivos de backup disponíveis na pasta backups/
 */
export function listarBackupsDisco(): ItemBackupDisco[] {
  garantirPastaBackups();

  try {
    const arquivos = fs.readdirSync(PASTA_BACKUPS);
    const backups: ItemBackupDisco[] = [];

    for (const arq of arquivos) {
      if (!arq.endsWith(".json")) continue;

      const caminho = path.join(PASTA_BACKUPS, arq);
      const stats = fs.statSync(caminho);

      let motivo = "Backup do sistema SGP";
      let autor = "Administrador Premier";

      try {
        const conteudo = JSON.parse(fs.readFileSync(caminho, "utf-8"));
        if (conteudo.motivo) motivo = conteudo.motivo;
        if (conteudo.autor) autor = conteudo.autor;
      } catch {
        // ignora se não conseguir ler detalhes
      }

      backups.push({
        nomeArquivo: arq,
        caminhoCompleto: caminho,
        tamanhoBytes: stats.size,
        tamanhoFormatado: formatarBytes(stats.size),
        dataCriacao: stats.birthtime.toISOString().replace("T", " ").substring(0, 19),
        dataModificacao: stats.mtime.toISOString().replace("T", " ").substring(0, 19),
        motivo,
        autor,
      });
    }

    // Ordena do mais recente para o mais antigo
    return backups.sort((a, b) => (b.dataModificacao > a.dataModificacao ? 1 : -1));
  } catch (err) {
    console.error("Erro ao listar backups do disco:", err);
    return [];
  }
}

/**
 * Lê o conteúdo de um backup específico
 */
export function lerBackupDisco(nomeArquivo: string): SnapshotBackupSGP | null {
  garantirPastaBackups();

  const nomeSanitizado = path.basename(nomeArquivo);
  const caminho = path.join(PASTA_BACKUPS, nomeSanitizado);

  if (!fs.existsSync(caminho)) {
    return null;
  }

  const conteudo = fs.readFileSync(caminho, "utf-8");
  return JSON.parse(conteudo) as SnapshotBackupSGP;
}
