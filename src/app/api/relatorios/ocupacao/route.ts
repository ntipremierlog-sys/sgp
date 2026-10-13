import { NextRequest, NextResponse } from "next/server";
import { gerarRelatorioOcupacaoPorPosto } from "@/lib/servicos/relatorios-oficiais";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const imovel = searchParams.get("imovel") || searchParams.get("unidadeId") || "TODAS";
    const posto = searchParams.get("posto") || searchParams.get("postoId") || "TODOS";
    const periodo = searchParams.get("periodo") || "2026-09";
    const busca = (searchParams.get("busca") || "").toLowerCase().trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limite = Math.max(1, parseInt(searchParams.get("limite") || "25", 10));

    // Executa a apuração oficial no serviço do servidor
    const relatorio = gerarRelatorioOcupacaoPorPosto({
      unidadeId: imovel,
      postoId: posto,
      periodo,
    });

    let itens = relatorio.itens;
    if (busca) {
      itens = itens.filter((it) =>
        it.unidadeNome.toLowerCase().includes(busca) ||
        it.postoCodigo.toLowerCase().includes(busca) ||
        it.postoFuncao.toLowerCase().includes(busca) ||
        it.titularNome.toLowerCase().includes(busca) ||
        it.titularMatricula.includes(busca) ||
        (it.secaoFormatada && it.secaoFormatada.toLowerCase().includes(busca)) ||
        (it.horarioFormatado && it.horarioFormatado.toLowerCase().includes(busca))
      );
    }

    const totalRegistros = itens.length;
    const totalPaginas = Math.max(1, Math.ceil(totalRegistros / limite));
    const paginaSegura = Math.min(page, totalPaginas);
    const paginadas = itens.slice((paginaSegura - 1) * limite, paginaSegura * limite);

    return NextResponse.json({
      sucesso: true,
      itens: paginadas,
      totais: relatorio.totais,
      totalRegistros,
      totalPaginas,
      paginaAtual: paginaSegura,
      limite,
    });
  } catch (error) {
    console.error("Erro na rota de API /api/relatorios/ocupacao:", error);
    return NextResponse.json(
      { sucesso: false, erro: "Falha ao processar apuração de ocupação por posto" },
      { status: 500 }
    );
  }
}
