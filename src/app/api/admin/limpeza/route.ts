import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { can } from "@/lib/auth/permissoes";
import {
  simularLimpezaDadosDemo,
  executarLimpezaDadosDemo,
} from "@/lib/dados/limpeza-dados-demo";
import {
  salvarBackupEmDisco,
  listarBackupsDisco,
  lerBackupDisco,
} from "@/lib/dados/backup-servidor";
import { restaurarSnapshotSistema } from "@/lib/dados/backup-dados";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/limpeza
 * Retorna a simulação da limpeza atual e a lista de backups disponíveis em disco.
 */
export async function GET(request: NextRequest) {
  try {
    const usuario = await obterSessaoServidor();

    // Verificação estrita de autorização
    if (!usuario || !can(usuario, "LER", "ADMINISTRACAO")) {
      return NextResponse.json(
        {
          sucesso: false,
          erro: "Acesso não permitido. Módulo restrito ao perfil Administrador Premier.",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const downloadArquivo = searchParams.get("download");

    // Rota de download direto de um arquivo de backup
    if (downloadArquivo) {
      const conteudo = lerBackupDisco(downloadArquivo);
      if (!conteudo) {
        return NextResponse.json(
          { sucesso: false, erro: "Arquivo de backup não encontrado." },
          { status: 404 }
        );
      }

      return new NextResponse(JSON.stringify(conteudo, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${downloadArquivo}"`,
        },
      });
    }

    const simulacao = simularLimpezaDadosDemo(usuario.nome);
    const backups = listarBackupsDisco();

    return NextResponse.json({
      sucesso: true,
      simulacao,
      backups,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

/**
 * POST /api/admin/limpeza
 * Executa simulação, limpeza definitiva com backup em disco, ou restauração de backup.
 */
export async function POST(request: NextRequest) {
  try {
    const usuario = await obterSessaoServidor();

    // Somente PREMIER_ADMIN pode executar limpeza ou restauração
    if (!usuario || !can(usuario, "CRIAR", "ADMINISTRACAO")) {
      return NextResponse.json(
        { sucesso: false, erro: "Acesso não permitido." },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const acao = body.acao || "EXECUTAR";

    if (acao === "SIMULAR") {
      const simulacao = simularLimpezaDadosDemo(usuario.nome);
      return NextResponse.json({ sucesso: true, simulacao });
    }

    if (acao === "EXECUTAR") {
      const resultado = executarLimpezaDadosDemo(usuario.nome);
      const backupGravado = salvarBackupEmDisco(
        resultado.snapshotBackup,
        "backup_limpeza_dados"
      );

      const backupsAtualizados = listarBackupsDisco();

      return NextResponse.json({
        sucesso: true,
        mensagem: "Limpeza de dados operacionais fictícios concluída com sucesso.",
        relatorio: resultado,
        backupGerado: backupGravado,
        backups: backupsAtualizados,
      });
    }

    if (acao === "LIMPAR_MAPA_OCUPACAO") {
      const { limparDadosOperacionaisOcupacao } = await import("@/lib/dados/limpeza-dados-demo");
      const resultado = limparDadosOperacionaisOcupacao(usuario.nome);
      const backupGravado = salvarBackupEmDisco(
        resultado.snapshotBackup,
        "backup_limpeza_mapa"
      );

      const backupsAtualizados = listarBackupsDisco();

      return NextResponse.json({
        sucesso: true,
        mensagem: "Limpeza das informações operacionais do Mapa de Ocupação concluída com sucesso.",
        relatorio: resultado,
        backupGerado: backupGravado,
        backups: backupsAtualizados,
      });
    }

    if (acao === "RESTAURAR") {
      const { nomeArquivo, snapshot } = body;
      let snapshotParaRestaurar = snapshot;

      if (!snapshotParaRestaurar && nomeArquivo) {
        snapshotParaRestaurar = lerBackupDisco(nomeArquivo);
      }

      if (!snapshotParaRestaurar) {
        return NextResponse.json(
          { sucesso: false, erro: "Snapshot de backup não informado ou não encontrado no disco." },
          { status: 400 }
        );
      }

      restaurarSnapshotSistema(snapshotParaRestaurar);

      return NextResponse.json({
        sucesso: true,
        mensagem: "Estado operacional restaurado com sucesso a partir do backup.",
        snapshot: snapshotParaRestaurar,
      });
    }

    return NextResponse.json(
      { sucesso: false, erro: `Ação "${acao}" não reconhecida.` },
      { status: 400 }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao processar solicitação de limpeza";
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}
