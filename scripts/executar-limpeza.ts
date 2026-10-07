/**
 * Script de Execução Direta: Limpeza Geral de Dados Fictícios (MOMENTO 1)
 * Salva o backup físico em backups/ e limpa dados operacionais.
 */
import {
  simularLimpezaDadosDemo,
  executarLimpezaDadosDemo,
} from "../src/lib/dados/limpeza-dados-demo";
import { salvarBackupEmDisco, listarBackupsDisco } from "../src/lib/dados/backup-servidor";
import { carregarEstado } from "../src/lib/dados/estado-operacional";

console.log("================================================================================");
console.log("   SGP — SISTEMA DE GESTÃO DE POSTOS (PREMIER LOGISTICS / PETROBRAS)");
console.log("   MOMENTO 1: EXECUÇÃO DA LIMPEZA DE DADOS FICTÍCIOS E BACKUP COMPLETO");
console.log("================================================================================\n");

// 1. Simulação prévia
const usuario = "Administrador Premier (Marcos Valério)";
console.log(`[1/4] Simulando limpeza com usuário: ${usuario}...`);
const simulacao = simularLimpezaDadosDemo(usuario);

console.log(`- Total de postos do Anexo 1-A preservados: ${simulacao.postosAnexo1APreservados}`);
console.log(`- Total de registros operacionais a remover: ${simulacao.totalRegistrosOperacionaisRemovidos}`);
simulacao.tabelasAfetadas.forEach((item) => {
  const icon = item.status === "PRESERVADO" ? "🛡️ PRESERVADO" : "🧹 LIMPO";
  console.log(`  • [${icon}] ${item.tabela.padEnd(45)} | Removidos: ${item.registrosRemovidos} | ${item.descricao}`);
});

// 2. Execução efetiva
console.log("\n[2/4] Executando limpeza efetiva...");
const resultado = executarLimpezaDadosDemo(usuario);

// 3. Gravação física do backup em disco
console.log("\n[3/4] Gravando arquivo de backup JSON no disco...");
const backupSalvo = salvarBackupEmDisco(
  resultado.snapshotBackup,
  "backup_pre_limpeza_dados_ficticios"
);
console.log(`✓ Backup físico gravado com sucesso:`);
console.log(`  Arquivo: ${backupSalvo.nomeArquivo}`);
console.log(`  Caminho: ${backupSalvo.caminhoCompleto}`);

// 4. Verificação de integridade pós-limpeza
console.log("\n[4/4] Verificando integridade pós-limpeza...");
const estadoFinal = carregarEstado();

const postosComTitular = estadoFinal.postos.filter((p) => !!p.titularMatricula);
console.log(`✓ Postos Anexo 1-A preservados: ${estadoFinal.postos.length} (todos ${estadoFinal.postos.length - postosComTitular.length} VAGOS)`);
console.log(`✓ Colaboradores no estado: ${estadoFinal.profissionais.length}`);
console.log(`✓ Ocorrências no estado: ${estadoFinal.ocorrencias.length}`);
console.log(`✓ Coberturas no estado: ${estadoFinal.coberturas.length}`);
console.log(`✓ Apontamentos no estado: ${estadoFinal.apontamentos.length}`);
console.log(`✓ Logs de auditoria: ${estadoFinal.logsAuditoria.length}`);

const backupsDisponiveis = listarBackupsDisco();
console.log(`\n✓ Total de backups em disco: ${backupsDisponiveis.length}`);
backupsDisponiveis.forEach((b) => {
  console.log(`  - ${b.nomeArquivo} (${b.tamanhoFormatado}) — ${b.motivo} [${b.dataModificacao}]`);
});

console.log("\n================================================================================");
console.log("   LIMPEZA GERAL DE DADOS FICTÍCIOS CONCLUÍDA COM SUCESSO!");
console.log("================================================================================");
