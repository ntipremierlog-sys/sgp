import { NextRequest, NextResponse } from "next/server";
import { gerarPlanilhaMedicaoXlsx } from "@/lib/exportadores/relatorio-medicao-xlsx";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor } from "@/lib/auth/permissoes-servidor";

export async function GET(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) {
    return NextResponse.json({ sucesso: false, erro: "Autenticação necessária." }, { status: 401 });
  }
  if (!canServidor(usuario, "EXPORTAR", "RELATORIOS")) {
    return NextResponse.json(
      { sucesso: false, erro: "Exportação de Relatórios não liberada para o seu perfil." },
      { status: 403 }
    );
  }
  const ocultarFinanceiro = !canServidor(usuario, "EXPORTAR", "GLOSA_FINANCEIRA");

  try {
    const { searchParams } = new URL(request.url);
    const competencia = searchParams.get("competencia") || "2026-09";
    const base = searchParams.get("base") || "TODAS";

    const baseSlug = base === "TODAS" ? "Contrato_Integral" : base.replace(/[\s/\\-]+/g, "_");
    const nomeArquivo = `SGP_Memoria_Calculo_Medicao_${baseSlug}_${competencia}.xlsx`;

    const buffer = gerarPlanilhaMedicaoXlsx(competencia, base, { ocultarFinanceiro });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      },
    });
  } catch (err: any) {
    console.error("Erro na API de exportação XLSX:", err);
    return NextResponse.json(
      { sucesso: false, erro: err?.message || "Falha ao gerar planilha Excel" },
      { status: 500 }
    );
  }
}
