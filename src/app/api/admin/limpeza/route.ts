import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * /api/admin/limpeza — DESATIVADA (Etapa 3 / B2).
 *
 * Não existem mais dados de demonstração: coberturas, ocorrências, pareceres,
 * apontamentos, postos, posições e profissionais vêm exclusivamente do banco
 * Neon PostgreSQL. A rotina de limpeza/restauração de dados demo foi desativada
 * para impedir que snapshots locais (com dados fictícios) sejam reinjetados.
 */
const RESPOSTA_DESATIVADA = {
  sucesso: false,
  erro: "Rotina de limpeza de dados de demonstração desativada. Os dados operacionais são gerenciados exclusivamente no banco de dados.",
  codigo: "ROTINA_DESATIVADA",
};

export async function GET() {
  return NextResponse.json(RESPOSTA_DESATIVADA, { status: 410 });
}

export async function POST() {
  return NextResponse.json(RESPOSTA_DESATIVADA, { status: 410 });
}
