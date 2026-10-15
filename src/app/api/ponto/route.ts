import { NextRequest, NextResponse } from "next/server";
import { obterSessaoServidor } from "@/lib/auth/sessao";
import { canServidor } from "@/lib/auth/permissoes-servidor";
import { obterMarcacoesPonto } from "@/lib/repositorio/marcacoes";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

function negado(status: 401 | 403) {
  return NextResponse.json(
    {
      sucesso: false,
      erro: status === 401 ? "Autenticacao necessaria." : "Acesso nao liberado para o seu perfil.",
    },
    { status }
  );
}

export async function GET(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) return negado(401);
  const podeVer =
    canServidor(usuario, "LER", "MAPA_OCUPACAO") ||
    canServidor(usuario, "LER", "POSTOS") ||
    canServidor(usuario, "LER", "PROFISSIONAIS");
  if (!podeVer) return negado(403);

  try {
    const { searchParams } = new URL(request.url);
    const dataFiltro = searchParams.get("data");
    const dataInicioParam = searchParams.get("dataInicio") || dataFiltro;
    const dataFimParam = searchParams.get("dataFim") || dataFiltro;
    const chapaParam = searchParams.get("chapa") || undefined;
    const chapasParam = searchParams.get("chapas")
      ? searchParams.get("chapas")!.split(",").map((s) => s.trim()).filter(Boolean)
      : undefined;
    const unidadeParam = searchParams.get("unidade") || searchParams.get("unidadeNome") || undefined;
    const limiteParam = searchParams.get("limite") ? parseInt(searchParams.get("limite")!, 10) : 5000;

    // Regra estrita: nunca retornar as 38.901 linhas de uma vez.
    // Se nenhum filtro de data for passado, limita a janela de 31 dias da competencia ativa.
    const dataInicio = dataInicioParam || "2026-08-10";
    const dataFim = dataFimParam || "2026-09-15";

    const lista = await obterMarcacoesPonto({
      dataInicio,
      dataFim,
      chapa: chapaParam,
      chapas: chapasParam,
      unidadeNome: unidadeParam,
      limite: Math.min(limiteParam, 10000),
    });

    const marcacoes = lista.map((m) => ({
      colaboradorId: m.colaboradorId || undefined,
      chapa: m.chapa,
      cpfLimpo: m.cpfLimpo || undefined,
      dataHoraUtc: m.dataHoraUtc ? m.dataHoraUtc.toISOString() : undefined,
      dataLocal: m.dataLocal,
      horaLocal: m.horaLocal,
      nsr: m.nsr || undefined,
      equipamentoOrigem: m.equipamentoOrigem || undefined,
    }));

    return NextResponse.json({
      sucesso: true,
      total: marcacoes.length,
      marcacoes,
      diasFolgaRm: [],
      dataReferencia: marcacoes.length > 0 ? "2026-09-15 23:59" : null,
      lotes: [],
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro interno ao obter dados de ponto.";
    console.error("Erro em /api/ponto GET:", err);
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const usuario = await obterSessaoServidor();
  if (!usuario) return negado(401);
  if (!canServidor(usuario, "CRIAR", "IMPORTACOES")) return negado(403);

  try {
    const body = await request.json();
    const { lote, marcacoes } = body;

    let totalInseridos = 0;
    if (Array.isArray(marcacoes) && marcacoes.length > 0) {
      const loteId = lote?.id || `lote-ponto-${Date.now()}`;
      const dadosInserir = marcacoes.map((m: any, index: number) => ({
        id: `${loteId}-${m.chapa}-${m.dataLocal}-${m.horaLocal}-${index}`,
        loteId,
        colaboradorId: m.colaboradorId || null,
        chapa: String(m.chapa),
        cpfLimpo: m.cpfLimpo || null,
        dataHoraUtc: m.dataHoraUtc ? new Date(m.dataHoraUtc) : null,
        dataLocal: m.dataLocal,
        horaLocal: m.horaLocal,
        nsr: m.nsr || null,
        equipamentoOrigem: m.equipamentoOrigem || null,
        importadoEm: new Date(),
      }));

      const res = await prisma.marcacaoPonto.createMany({
        data: dadosInserir,
        skipDuplicates: true,
      });
      totalInseridos = res.count;
    }

    return NextResponse.json({
      sucesso: true,
      mensagem: `${totalInseridos} novas marcacoes gravadas com sucesso no banco de dados.`,
      totalInseridos,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar marcacoes no banco.";
    console.error("Erro em /api/ponto POST:", err);
    return NextResponse.json({ sucesso: false, erro: msg }, { status: 500 });
  }
}